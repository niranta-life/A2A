const duckdb = require('duckdb');

// Use an in-memory database for simplicity, or specify a file path e.g., 'app.db'
const db = new duckdb.Database(':memory:'); 

// Function to initialize the database and create tables
async function initializeDB() {
  // It's common for DuckDB Node.js driver operations to be asynchronous,
  // returning Promises. We'll use a connection pool or a single connection.
  // For simplicity, we'll use the main 'db' object which acts as a default connection.
  
  // Helper function to run SQL commands (promisified for async/await)
  const runSQL = (sql) => {
    return new Promise((resolve, reject) => {
      db.run(sql, function(err) { // Use `function` to access `this.lastID` or `this.changes` if needed, though not here.
        if (err) {
          console.error("Error executing SQL: ", sql, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  try {
    console.log("Initializing database and creating tables...");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        name TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'conversations' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        task_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL, -- Store JSON array of parts here
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
    console.log("Table 'messages' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state_details TEXT, -- Store JSON object of status details
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
    console.log("Table 'tasks' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS task_artifacts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        artifact_id_ref TEXT,
        content TEXT NOT NULL, -- Store JSON array of artifact parts
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);
    console.log("Table 'task_artifacts' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        icon TEXT,
        url TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'agents' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        actor TEXT,
        event_type TEXT NOT NULL, -- e.g., 'message', 'task_update', 'agent_registered'
        data TEXT NOT NULL, -- JSON representation of the event
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
    `);
    console.log("Table 'events' created or already exists.");

    await runSQL(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT,
        mime_type TEXT NOT NULL,
        data BLOB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'files' created or already exists.");

    console.log("Database initialization complete.");
    return db; // Return the database instance
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error; // Re-throw error to be caught by caller
  }
}

// Export a promise that resolves with the initialized DB connection.
// This ensures that any module importing this will wait for the DB to be ready.
const dbConnectionPromise = initializeDB();

module.exports = {
  dbConnectionPromise,
  // Optionally, export the raw 'db' object if direct synchronous access is needed
  // before initialization (though not recommended for operations requiring tables).
  // db_instance: db 
};
