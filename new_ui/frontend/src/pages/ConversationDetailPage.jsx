import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';

import ChatBubble from '../components/ChatBubble'; // Created in previous step
import * as apiService from '../services/apiService';
import websocketService from '../services/websocketService';

export default function ConversationDetailPage() {
  const { id: conversationId } = useParams();
  const [conversation, setConversation] = useState(null); // For conversation metadata if needed
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [errorMessages, setErrorMessages] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [tasks, setTasks] = useState([]); // Basic state for tasks

  const messagesEndRef = useRef(null); // For auto-scrolling

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Scroll when messages change

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoadingMessages(true);
    setErrorMessages(null);
    try {
      const fetchedMessages = await apiService.listMessages(conversationId);
      // The backend /message/list already parses content, so no need to parse here.
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setErrorMessages(err.message || 'Failed to fetch messages.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    // Optionally, fetch conversation details if needed:
    // apiService.getConversationDetails(conversationId).then(setConversation).catch(console.error);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    // Connect WebSocket on mount if not already connected
    if (websocketService.getReadyState() !== WebSocket.OPEN && websocketService.getReadyState() !== WebSocket.CONNECTING) {
        websocketService.connect();
    }

    const handleWebSocketMessage = (message) => {
      if (message.type === 'new_message' && message.data?.conversation_id === conversationId) {
        console.log('WebSocket: New message received for this conversation', message.data);
        setMessages(prevMessages => {
          // Avoid duplicates if message already exists (e.g., from optimistic update)
          if (prevMessages.find(m => m.id === message.data.id)) {
            return prevMessages;
          }
          return [...prevMessages, message.data];
        });
      } else if (message.type === 'task_updated' && message.data?.conversation_id === conversationId) {
        console.log('WebSocket: Task updated for this conversation', message.data);
        setTasks(prevTasks => {
          const existingTaskIndex = prevTasks.findIndex(t => t.id === message.data.id);
          if (existingTaskIndex !== -1) {
            const updatedTasks = [...prevTasks];
            updatedTasks[existingTaskIndex] = message.data;
            return updatedTasks;
          }
          return [...prevTasks, message.data];
        });
      }
    };

    websocketService.onMessage(handleWebSocketMessage);

    return () => {
      websocketService.offMessage(handleWebSocketMessage);
      // Optional: Disconnect WebSocket if not used by other components
      // This is often managed globally or based on app visibility.
      // websocketService.disconnect(); 
    };
  }, [conversationId]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessageText.trim()) return;

    setSendingMessage(true);
    setErrorMessages(null); // Clear previous errors on new action

    const messagePayload = {
      role: 'user', // Assuming messages sent from here are always 'user'
      content_parts: [{ type: 'text', text: newMessageText.trim() }],
      // task_id: null, // Set if relevant
    };

    try {
      // The API service sends the message. The WebSocket listener should pick it up.
      // No optimistic update here to keep it simpler and rely on WebSocket for consistency.
      await apiService.sendMessage(conversationId, messagePayload);
      setNewMessageText(''); // Clear input field
    } catch (err) {
      console.error("Error sending message:", err);
      setErrorMessages(err.message || 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', /* Adjust based on AppBar/other fixed elements */ }}>
      <Typography variant="h5" component="h1" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
        Conversation: {conversation?.name || conversationId}
      </Typography>

      {/* Basic Task Display - Can be improved */}
      {tasks.length > 0 && (
        <Paper sx={{ p: 1, m:1, backgroundColor: 'info.light' }}>
          <Typography variant="subtitle2">Active Tasks:</Typography>
          {tasks.map(task => (
            <Typography key={task.id} variant="caption">
              Task {task.id.substring(0,6)}...: {task.status}
            </Typography>
          ))}
        </Paper>
      )}

      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {loadingMessages && <CircularProgress sx={{ display: 'block', margin: 'auto' }} />}
        {errorMessages && <Alert severity="error" onClose={() => setErrorMessages(null)}>{errorMessages}</Alert>}
        {!loadingMessages && messages.length === 0 && !errorMessages && (
          <Typography sx={{ textAlign: 'center', color: 'text.secondary' }}>
            No messages yet. Send one to start the conversation!
          </Typography>
        )}
        {messages.map((msg) => (
          // Assuming currentUserId is 'user' for messages sent by this UI client
          <ChatBubble key={msg.id} message={msg} currentUserId="user" />
        ))}
        <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
      </Box>

      <Paper component="form" onSubmit={handleSendMessage} sx={{ p: 1, borderTop: '1px solid #ddd', backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            disabled={sendingMessage}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            sx={{ mr: 1 }}
          />
          <IconButton type="submit" color="primary" disabled={sendingMessage || !newMessageText.trim()}>
            {sendingMessage ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
}
