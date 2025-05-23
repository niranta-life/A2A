// Import node-fetch. Note: In a real environment, ensure this is installed via npm.
// const fetch = require('node-fetch'); // For CommonJS modules if not using "type": "module" in package.json
// For ES Modules (if backend package.json had "type": "module"):
// import fetch from 'node-fetch'; 
// Given the current setup, we'll use require, assuming a typical CommonJS environment for Node.js backend.

// Dynamically import node-fetch
let fetch;
const importFetch = new Function('return import("node-fetch")');

(async () => {
  try {
    const nodeFetch = await importFetch();
    fetch = nodeFetch.default; // Or nodeFetch if it's not a default export
  } catch (err) {
    console.error("Failed to dynamically import node-fetch. Ensure it's installed and accessible.", err);
    // Fallback or error handling if fetch cannot be imported
    // For the purpose of this script, we'll let it proceed, and calls to fetch() will fail.
  }
})();


// Base URL for the Python ADK Host - Placeholder, should be configurable
const PYTHON_ADK_HOST_BASE_URL = process.env.PYTHON_ADK_HOST_URL || 'http://localhost:8000'; // Port 8000 is a common default for dev servers

// API Key for Python ADK Host
let currentApiKey = process.env.PYTHON_ADK_API_KEY || '';

/**
 * Updates the API key used for communicating with the Python ADK host.
 * @param {string} newKey - The new API key.
 */
function updateApiKey(newKey) {
  currentApiKey = newKey;
  console.log('Host connector API key updated.');
}

/**
 * Registers an agent with the Python ADK host.
 * @param {string} agentUrl - The URL of the agent to register.
 * @returns {Promise<object>} - The response data from the host or an error object.
 */
async function registerAgent(agentUrl) {
  if (!fetch) {
    console.error("fetch is not available. node-fetch might not be installed or failed to load.");
    return { error: true, message: "Fetch client not available." };
  }

  const endpoint = `${PYTHON_ADK_HOST_BASE_URL}/register_agent_service`;
  try {
    console.log(`Attempting to register agent at URL: ${agentUrl} via endpoint: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentApiKey // Add API key header
      },
      body: JSON.stringify({ agent_url: agentUrl }),
    });

    if (!response.ok) {
      const errorBody = await response.text(); // Get more details if possible
      console.error(`Error registering agent. Status: ${response.status}, Body: ${errorBody}`);
      return { error: true, status: response.status, message: `Failed to register agent: ${response.statusText}`, details: errorBody };
    }

    const data = await response.json();
    console.log("Agent registered successfully:", data);
    return data;
  } catch (error) {
    console.error("Network or other error during agent registration:", error);
    return { error: true, message: error.message, details: error.stack };
  }
}

/**
 * Creates a new conversation with the Python ADK host.
 * @returns {Promise<object>} - The conversation data (e.g., { id: 'new_conv_id' }) or an error object.
 */
async function createConversation() {
  if (!fetch) {
    console.error("fetch is not available. node-fetch might not be installed or failed to load.");
    return { error: true, message: "Fetch client not available." };
  }

  const endpoint = `${PYTHON_ADK_HOST_BASE_URL}/create_conversation_service`;
  try {
    console.log(`Attempting to create conversation via endpoint: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentApiKey // Add API key header
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error creating conversation. Status: ${response.status}, Body: ${errorBody}`);
      return { error: true, status: response.status, message: `Failed to create conversation: ${response.statusText}`, details: errorBody };
    }

    const data = await response.json();
    console.log("Conversation created successfully:", data);
    return data; 
  } catch (error) {
    console.error("Network or other error during conversation creation:", error);
    return { error: true, message: error.message, details: error.stack };
  }
}

/**
 * Sends a message to the Python ADK host.
 * @param {object} messageData - The message object (e.g., { messageId, contextId, role, parts: [...] }).
 * @returns {Promise<object>} - The response data from the host or an error object.
 */
async function sendMessageToHost(messageData) {
  if (!fetch) {
    console.error("fetch is not available. node-fetch might not be installed or failed to load.");
    return { error: true, message: "Fetch client not available." };
  }

  const endpoint = `${PYTHON_ADK_HOST_BASE_URL}/send_message_service`; // Assumed endpoint
  try {
    console.log(`Attempting to send message to host via endpoint: ${endpoint}`, messageData);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentApiKey // Add API key header
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error sending message to host. Status: ${response.status}, Body: ${errorBody}`);
      return { error: true, status: response.status, message: `Failed to send message: ${response.statusText}`, details: errorBody };
    }

    const data = await response.json(); // Host might return an ack or the agent's first response part
    console.log("Message sent to host successfully, response:", data);
    return data;
  } catch (error) {
    console.error("Network or other error during sending message to host:", error);
    return { error: true, message: error.message, details: error.stack };
  }
}

module.exports = {
  registerAgent,
  createConversation,
  sendMessageToHost,
  updateApiKey, // Export the new function
};
