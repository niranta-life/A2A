const express = require('express');
const http = require('http'); // Import http module
const { WebSocketServer, WebSocket } = require('ws'); // Import WebSocketServer and WebSocket
const { dbConnectionPromise } = require('./database');
const { registerAgent, createConversation, sendMessageToHost, updateApiKey } = require('./host_connector'); // Import updateApiKey

const app = express();
const port = 3001;

// Create an HTTP server instance using the Express app
const server = http.createServer(app);

// Middleware to parse JSON bodies, with increased limit for file uploads
app.use(express.json({ limit: '50mb' }));

// Simple UUID v4 generator (to avoid npm install issues)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Promise-based DuckDB helpers
function asyncDbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, function(err) { // Use 'function' for 'this'
      if (err) {
        console.error("Error executing DB run:", sql, params, err);
        return reject(err);
      }
      resolve(this); // 'this' contains lastID and changes
    });
  });
}

function asyncDbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err, rows) => {
      if (err) {
        console.error("Error executing DB all:", sql, params, err);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

// Helper to get a single task with its artifacts
async function getTaskWithArtifacts(db, taskId) {
    const taskRows = await asyncDbAll(db, 'SELECT id, conversation_id, status, state_details, created_at, updated_at FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
        return null;
    }
    const task = taskRows[0];

    try {
        task.state_details = task.state_details ? JSON.parse(task.state_details) : null;
    } catch (e) {
        console.error("Error parsing task state_details from DB:", task.id, e);
        task.state_details = { error: "Could not parse state_details." };
    }

    const artifactsRows = await asyncDbAll(db, 'SELECT id, task_id, artifact_id_ref, content, created_at FROM task_artifacts WHERE task_id = ? ORDER BY created_at ASC', [task.id]);
    task.artifacts = artifactsRows.map(art => {
        try {
            return { ...art, content: JSON.parse(art.content) };
        } catch (e) {
            console.error("Error parsing artifact content from DB:", art.id, e);
            return { ...art, content: [{ type: 'error', text: 'Error: Could not parse artifact content.' }] };
        }
    });
    return task;
}


// --- WebSocket Setup ---
const wss = new WebSocketServer({ server }); // Attach WebSocket server to the HTTP server
const clients = new Set(); // To store connected WebSocket clients

console.log(`WebSocket Server created, waiting for HTTP server to listen.`);

// Broadcast function to send data to all connected clients
function broadcast(data) {
  const jsonData = JSON.stringify(data);
  console.log("Broadcasting message:", jsonData);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log("Client connected to WebSocket");
  ws.send(JSON.stringify({ type: 'system', message: 'Connected to WebSocket server' }));

  ws.on('message', (message) => {
    try {
      const messageString = message.toString();
      console.log("Received WebSocket message:", messageString);
      const parsedMessage = JSON.parse(messageString); 
      broadcast(parsedMessage); 
    } catch (e) {
      console.error("Failed to parse or broadcast message:", e);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log("Client disconnected from WebSocket");
  });

  ws.on('error', (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws); 
  });
});


// --- API Route Implementations ---

// POST /conversation/create
app.post('/conversation/create', async (req, res) => {
  try {
    const db = await dbConnectionPromise;
    const hostResponse = await createConversation();

    if (hostResponse.error) {
      console.error("Host error creating conversation:", hostResponse);
      return res.status(500).json({ message: "Failed to create conversation with host", details: hostResponse.message });
    }

    const conversationId = generateUUID();
    const conversationName = hostResponse.name || `Conversation ${conversationId.substring(0, 8)}`; 
    const isActive = true;

    await asyncDbRun(db, 
      'INSERT INTO conversations (id, name, is_active) VALUES (?, ?, ?)', 
      [conversationId, conversationName, isActive]
    );
    
    const newConversationData = { 
      id: conversationId, 
      name: conversationName, 
      is_active: isActive, 
      created_at: new Date().toISOString() 
    };
    broadcast({ type: 'conversation_created', data: newConversationData });

    res.status(201).json({ ...newConversationData, message: "Conversation created successfully" });

  } catch (error) {
    console.error("Error in /conversation/create:", error);
    res.status(500).json({ message: "Internal server error creating conversation", details: error.message });
  }
});

// POST /conversation/list
app.post('/conversation/list', async (req, res) => {
  try {
    const db = await dbConnectionPromise;
    const conversations = await asyncDbAll(db, 
      'SELECT id, name, is_active, created_at FROM conversations ORDER BY created_at DESC'
    );
    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in /conversation/list:", error);
    res.status(500).json({ message: "Internal server error listing conversations", details: error.message });
  }
});

// POST /agent/register
app.post('/agent/register', async (req, res) => {
  const { agent_url: agentUrl } = req.body;

  if (!agentUrl) {
    return res.status(400).json({ message: "agent_url is required in the request body." });
  }

  try {
    const db = await dbConnectionPromise;
    const hostResponse = await registerAgent(agentUrl);

    if (hostResponse.error) {
      console.error("Host error registering agent:", hostResponse);
      return res.status(500).json({ message: "Failed to register agent with host", details: hostResponse.message });
    }
    
    const agentId = generateUUID();
    const agentName = hostResponse.data?.name || `Agent at ${agentUrl}`;
    const agentDescription = hostResponse.data?.description || "No description provided.";
    const agentIcon = hostResponse.data?.icon;

    await asyncDbRun(db,
      'INSERT INTO agents (id, url, name, description, icon) VALUES (?, ?, ?, ?, ?)',
      [agentId, agentUrl, agentName, agentDescription, agentIcon]
    );

    const newAgentData = {
      id: agentId, 
      url: agentUrl, 
      name: agentName, 
      description: agentDescription,
      icon: agentIcon,
      created_at: new Date().toISOString()
    };
    broadcast({ type: 'agent_registered', data: newAgentData });

    res.status(201).json({ ...newAgentData, message: "Agent registered successfully" });

  } catch (error) {
    console.error("Error in /agent/register:", error);
    if (error.message && error.message.includes('UNIQUE constraint failed: agents.url')) {
        return res.status(409).json({ message: "Agent with this URL already registered.", details: error.message });
    }
    res.status(500).json({ message: "Internal server error registering agent", details: error.message });
  }
});

// POST /agent/list
app.post('/agent/list', async (req, res) => {
  try {
    const db = await dbConnectionPromise;
    const agents = await asyncDbAll(db, 
      'SELECT id, name, description, icon, url, created_at FROM agents ORDER BY created_at DESC'
    );
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error in /agent/list:", error);
    res.status(500).json({ message: "Internal server error listing agents", details: error.message });
  }
});


// POST /message/send
app.post('/message/send', async (req, res) => {
  const { conversation_id, role, content, task_id } = req.body;

  if (!conversation_id || !role || !content || !Array.isArray(content)) {
    return res.status(400).json({ message: "Missing required fields: conversation_id, role, and content (must be an array)." });
  }
  if (role !== 'user' && role !== 'agent') {
      return res.status(400).json({ message: "Role must be 'user' or 'agent'."});
  }

  try {
    const db = await dbConnectionPromise;
    const messageId = generateUUID();
    const createdAt = new Date().toISOString();
    const messageDataForHost = { messageId, contextId: conversation_id, role, parts: content };
    if (task_id) messageDataForHost.taskId = task_id;

    const hostResponse = await sendMessageToHost(messageDataForHost);
    if (hostResponse.error) {
      console.error("Host error sending message:", hostResponse);
      return res.status(500).json({ message: "Failed to send message to host", details: hostResponse.message });
    }
    console.log("Host response from sendMessageToHost:", hostResponse);

    const storedMessageData = { id: messageId, conversation_id, task_id: task_id || null, role, content: JSON.stringify(content), created_at: createdAt };
    await asyncDbRun(db,
      'INSERT INTO messages (id, conversation_id, task_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [storedMessageData.id, storedMessageData.conversation_id, storedMessageData.task_id, storedMessageData.role, storedMessageData.content, storedMessageData.created_at]
    );
    const broadcastPayload = { ...storedMessageData, content: content };
    broadcast({ type: 'new_message', data: broadcastPayload });
    res.status(201).json({ message: "Message sent and stored successfully", data: broadcastPayload });
  } catch (error) {
    console.error("Error in /message/send:", error);
    res.status(500).json({ message: "Internal server error sending message", details: error.message });
  }
});

// POST /message/list
app.post('/message/list', async (req, res) => {
  const { conversation_id } = req.body;
  if (!conversation_id) return res.status(400).json({ message: "conversation_id is required." });

  try {
    const db = await dbConnectionPromise;
    const messages = await asyncDbAll(db, 
      'SELECT id, conversation_id, task_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', 
      [conversation_id]
    );
    const formattedMessages = messages.map(msg => {
      try { return { ...msg, content: JSON.parse(msg.content) }; } 
      catch (e) { console.error("Error parsing message content from DB:", msg.id, e); return { ...msg, content: [{ type: 'error', text: 'Error: Could not parse message content.' }] }; }
    });
    res.status(200).json(formattedMessages);
  } catch (error) {
    console.error("Error in /message/list:", error);
    res.status(500).json({ message: "Internal server error listing messages", details: error.message });
  }
});

// POST /task/list
app.post('/task/list', async (req, res) => {
  const { conversation_id } = req.body;
  try {
    const db = await dbConnectionPromise;
    let query = 'SELECT id, conversation_id, status, state_details, created_at, updated_at FROM tasks';
    const params = [];
    if (conversation_id) {
      query += ' WHERE conversation_id = ?';
      params.push(conversation_id);
    }
    query += ' ORDER BY created_at DESC';

    const tasks = await asyncDbAll(db, query, params);
    const formattedTasks = [];

    for (const task of tasks) {
      try {
        task.state_details = task.state_details ? JSON.parse(task.state_details) : null;
      } catch (e) {
        console.error("Error parsing task state_details from DB:", task.id, e);
        task.state_details = { error: "Could not parse state_details." };
      }
      const artifactsRows = await asyncDbAll(db, 'SELECT id, task_id, artifact_id_ref, content, created_at FROM task_artifacts WHERE task_id = ? ORDER BY created_at ASC', [task.id]);
      task.artifacts = artifactsRows.map(art => {
        try { return { ...art, content: JSON.parse(art.content) }; } 
        catch (e) { console.error("Error parsing artifact content from DB:", art.id, e); return { ...art, content: [{ type: 'error', text: 'Error: Could not parse artifact content.' }] }; }
      });
      formattedTasks.push(task);
    }
    res.status(200).json(formattedTasks);
  } catch (error) {
    console.error("Error in /task/list:", error);
    res.status(500).json({ message: "Internal server error listing tasks", details: error.message });
  }
});

// POST /host/task_update (Webhook for Python ADK host)
app.post('/host/task_update', async (req, res) => {
  console.log("Received /host/task_update:", JSON.stringify(req.body, null, 2));
  const { id: taskId, contextId: conversation_id, status, state_details, artifacts } = req.body;

  if (!taskId || !conversation_id || !status) {
    return res.status(400).json({ message: "Missing required fields: id (taskId), contextId (conversation_id), status." });
  }

  try {
    const db = await dbConnectionPromise;
    const stateDetailsString = JSON.stringify(state_details || status);

    const existingTask = await asyncDbAll(db, 'SELECT id FROM tasks WHERE id = ?', [taskId]);

    if (existingTask.length > 0) {
      await asyncDbRun(db,
        'UPDATE tasks SET conversation_id = ?, status = ?, state_details = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [conversation_id, status, stateDetailsString, taskId]
      );
    } else {
      await asyncDbRun(db,
        'INSERT INTO tasks (id, conversation_id, status, state_details, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [taskId, conversation_id, status, stateDetailsString]
      );
    }

    if (Array.isArray(artifacts)) {
      for (const artifact of artifacts) {
        if (!artifact.artifactId || !artifact.content) {
          console.warn("Skipping artifact due to missing artifactId or content:", artifact);
          continue;
        }
        const artifactDbId = generateUUID();
        const artifactContentString = JSON.stringify(artifact.content);
        await asyncDbRun(db,
          'INSERT OR REPLACE INTO task_artifacts (id, task_id, artifact_id_ref, content, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [artifactDbId, taskId, artifact.artifactId, artifactContentString]
        );
      }
    }
    
    const completeTaskData = await getTaskWithArtifacts(db, taskId);
    if (completeTaskData) {
        broadcast({ type: 'task_updated', data: completeTaskData });
    }

    res.status(200).json({ status: "received", taskId: taskId });
  } catch (error) {
    console.error("Error in /host/task_update:", error);
    res.status(500).json({ message: "Internal server error processing task update", details: error.message });
  }
});

// POST /api_key/update
app.post('/api_key/update', async (req, res) => {
  const { api_key: apiKey } = req.body;

  if (typeof apiKey !== 'string') {
    return res.status(400).json({ message: "api_key (string) is required in the request body." });
  }

  try {
    updateApiKey(apiKey);
    res.status(200).json({ status: "success", message: "API key updated for future host communications." });
  } catch (error) {
    console.error("Error in /api_key/update:", error);
    res.status(500).json({ message: "Internal server error updating API key.", details: error.message });
  }
});

// POST /host/file_received (Webhook for Python ADK host to send files)
app.post('/host/file_received', async (req, res) => {
  let { file_id: fileId, name, mime_type: mimeType, bytes } = req.body;

  if (!name || !mimeType || !bytes) {
    return res.status(400).json({ message: "Missing required fields: name, mime_type, bytes (base64 encoded)." });
  }

  if (!fileId) {
    fileId = generateUUID();
  }

  try {
    const db = await dbConnectionPromise;
    const fileDataBuffer = Buffer.from(bytes, 'base64');

    await asyncDbRun(db,
      'INSERT INTO files (id, name, mime_type, data) VALUES (?, ?, ?, ?)',
      [fileId, name, mimeType, fileDataBuffer]
    );

    res.status(200).json({ status: "file_received", file_id: fileId });

  } catch (error) {
    console.error("Error in /host/file_received:", error);
    if (error.message.includes('bad base-64')) { // More specific error for base64 issues
        return res.status(400).json({ message: "Invalid base64 data in 'bytes' field.", details: error.message });
    }
    res.status(500).json({ message: "Internal server error receiving file.", details: error.message });
  }
});

// GET /message/file/:file_id
app.get('/message/file/:file_id', async (req, res) => {
  const { file_id: fileId } = req.params;

  if (!fileId) {
    return res.status(400).json({ message: "file_id parameter is required." });
  }

  try {
    const db = await dbConnectionPromise;
    // Use .get() for fetching a single row if your asyncDbAll is a wrapper around db.all
    // Or, if asyncDbAll is flexible, ensure it can return a single object or handle an array of 1.
    // For DuckDB node driver, db.get is for prepared statements. db.all is fine, just take first row.
    const rows = await asyncDbAll(db, 'SELECT name, mime_type, data FROM files WHERE id = ?', [fileId]);

    if (rows.length > 0) {
      const file = rows[0];
      res.setHeader('Content-Type', file.mime_type);
      // Optional: Add Content-Disposition if you want to suggest a filename for download
      // res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.send(file.data); // file.data should be a Buffer
    } else {
      res.status(404).json({ message: "File not found." });
    }
  } catch (error) {
    console.error("Error in /message/file/:file_id:", error);
    res.status(500).json({ message: "Internal server error retrieving file.", details: error.message });
  }
});


// --- Other Placeholder API route handlers ---
app.post('/events/get', (req, res) => {
  res.json({ message: "Endpoint /events/get called - to be implemented" });
});

app.post('/message/pending', (req, res) => {
  res.json({ message: "Endpoint /message/pending called - to be implemented" });
});

// Start the server
dbConnectionPromise.then(db => {
  console.log("Database connection established, preparing to start HTTP server...");
  server.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
    console.log(`WebSocket server is sharing the same port.`);
  });
}).catch(error => {
  console.error("Failed to initialize database. Server not started.", error);
});
