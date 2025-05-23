const BASE_URL = 'http://localhost:3001'; // Assuming backend is running on this port

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    console.error('API Error:', response.status, errorData);
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  // Check if response is JSON before parsing
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text(); // Or handle as needed, e.g., for file downloads if not handled by getFileUrl
  }
}

async function postRequest(endpoint, body = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function listConversations() {
  return postRequest('/conversation/list');
}

export async function createConversation() {
  return postRequest('/conversation/create');
}

export async function listMessages(conversationId) {
  if (!conversationId) throw new Error('conversationId is required to list messages.');
  return postRequest('/message/list', { conversation_id: conversationId });
}

// messageData: { role: string, content_parts: Array<Object>, task_id?: string }
export async function sendMessage(conversationId, messageData) {
  if (!conversationId || !messageData || !messageData.role || !messageData.content_parts) {
    throw new Error('conversationId, role, and content_parts are required to send a message.');
  }
  const payload = {
    conversation_id: conversationId,
    role: messageData.role,
    content: messageData.content_parts, // Backend expects 'content' for the array of parts
    task_id: messageData.task_id, // Optional
  };
  return postRequest('/message/send', payload);
}

export async function listTasks(conversationId = null) {
  const body = conversationId ? { conversation_id: conversationId } : {};
  return postRequest('/task/list', body);
}

export async function listAgents() {
  return postRequest('/agent/list');
}

export async function registerAgent(agentUrl) {
  if (!agentUrl) throw new Error('agentUrl is required to register an agent.');
  return postRequest('/agent/register', { agent_url: agentUrl });
}

export async function updateApiKey(apiKey) {
  // Ensure apiKey is a string, even if empty
  if (typeof apiKey !== 'string') throw new Error('apiKey must be a string.');
  return postRequest('/api_key/update', { api_key: apiKey });
}

export function getFileUrl(fileId) {
  if (!fileId) {
    console.warn('fileId is required to get file URL. Returning placeholder or empty string.');
    return ''; // Or a placeholder image/URL
  }
  return `${BASE_URL}/message/file/${fileId}`;
}

// Example for a GET request if needed later, not part of current spec but good for completeness
// export async function getExample(id) {
//   const response = await fetch(`${BASE_URL}/example/${id}`);
//   return handleResponse(response);
// }
