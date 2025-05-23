const WEBSOCKET_URL = 'ws://localhost:3001'; // Assuming backend WebSocket is on the same port

let socket = null;
const messageListeners = new Set(); // Using a Set to avoid duplicate callbacks

const websocketService = {
  connect: () => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting.');
      return;
    }

    socket = new WebSocket(WEBSOCKET_URL);
    console.log('Attempting WebSocket connection...');

    socket.onopen = () => {
      console.log('WebSocket connection established.');
      // Optionally send a ping or an init message if the server expects one
      // socket.send(JSON.stringify({ type: 'client_hello', message: 'Hello from client!' }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        messageListeners.forEach(callback => callback(message));
      } catch (error) {
        console.error('Error parsing WebSocket message or in callback:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed.', event.code, event.reason);
      socket = null; // Clear the socket instance
      // Simple retry mechanism (optional, can be made more sophisticated)
      // setTimeout(() => {
      //   console.log('Attempting to reconnect WebSocket...');
      //   websocketService.connect();
      // }, 5000); // Retry after 5 seconds
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // The 'onclose' event will usually follow an error.
      // If not, ensure socket is cleaned up.
      if (socket && socket.readyState !== WebSocket.CLOSED) {
         socket.close(); // Attempt to close if not already closed
      }
      // socket = null; // Could also nullify here if onclose isn't reliably called after certain errors
    };
  },

  disconnect: () => {
    if (socket) {
      console.log('Disconnecting WebSocket...');
      socket.close();
      // socket = null; // onclose should handle this
    } else {
      console.log('WebSocket not connected.');
    }
  },

  onMessage: (callback) => {
    if (typeof callback === 'function') {
      messageListeners.add(callback);
      console.log('Message listener added.');
    } else {
      console.error('Attempted to register non-function as message listener:', callback);
    }
  },

  // Allow unregistering listeners to prevent memory leaks in components
  offMessage: (callback) => {
    messageListeners.delete(callback);
    console.log('Message listener removed.');
  },

  sendMessage: (data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const jsonData = JSON.stringify(data);
        console.log('Sending WebSocket message:', jsonData);
        socket.send(jsonData);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected or not open. Message not sent:', data);
    }
  },

  // Expose socket state if needed by UI components (e.g., to show connection status)
  getReadyState: () => {
    return socket ? socket.readyState : WebSocket.CLOSED; // Or a custom status enum
  }
};

// Optionally, auto-connect when the service is loaded, or require manual connect() call from app root.
// For this exercise, manual connection is preferred.
// websocketService.connect(); 

export default websocketService;
