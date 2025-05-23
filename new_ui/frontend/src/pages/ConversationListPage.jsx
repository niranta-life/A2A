import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Box from '@mui/material/Box';
import AddCommentIcon from '@mui/icons-material/AddComment';

import * as apiService from '../services/apiService';
import websocketService from '../services/websocketService';

export default function ConversationListPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listConversations();
      setConversations(data || []); // Ensure data is not null/undefined
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError(err.message || 'Failed to fetch conversations.');
      setConversations([]); // Clear conversations on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    // Connect WebSocket on mount
    if (websocketService.getReadyState() !== WebSocket.OPEN) {
        websocketService.connect();
    }

    const handleWebSocketMessage = (message) => {
      if (message.type === 'conversation_created') {
        console.log('WebSocket: Conversation created event received', message.data);
        // For a more robust update, you could merge this new conversation
        // into the existing list or re-fetch.
        // For now, just re-fetching.
        fetchConversations(); 
      }
      // Can handle other types of messages here, e.g., 'conversation_updated', 'conversation_deleted'
    };

    websocketService.onMessage(handleWebSocketMessage);

    // Cleanup on unmount
    return () => {
      websocketService.offMessage(handleWebSocketMessage);
      // Consider if websocketService.disconnect() should be called here.
      // If other pages also use it, it might be better to manage connection globally.
      // For this page-specific logic, it's fine to disconnect if no other component needs it.
    };
  }, [fetchConversations]); // Add fetchConversations to dependencies if it's used in handleWebSocketMessage

  const handleCreateConversation = async () => {
    setCreating(true);
    setError(null);
    try {
      const newConversation = await apiService.createConversation();
      console.log('New conversation created:', newConversation);
      // The WebSocket event should ideally handle the list update.
      // But as a fallback or for immediate feedback, we can manually fetch or add.
      // For this subtask, we rely on WebSocket broadcast or manual refresh.
      // fetchConversations(); // Or optimistically add to list: setConversations(prev => [newConversation, ...prev]);
    } catch (err) {
      console.error("Error creating conversation:", err);
      setError(err.message || 'Failed to create conversation.');
    } finally {
      setCreating(false);
    }
  };

  if (loading && conversations.length === 0) { // Show loading only on initial load
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Conversations
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCommentIcon />}
          onClick={handleCreateConversation}
          disabled={creating || loading}
        >
          {creating ? 'Creating...' : 'Create New Conversation'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {loading && <Typography sx={{my: 2}}>Refreshing list...</Typography>}

      {conversations.length === 0 && !loading && !error && (
        <Typography sx={{mt: 2}}>No conversations yet. Create one to get started!</Typography>
      )}

      <List>
        {conversations.map((conv) => (
          <Card key={conv.id} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                {conv.name || `Conversation ${conv.id.substring(0,8)}`}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                ID: {conv.id}
              </Typography>
              <Typography variant="body2">
                Created: {new Date(conv.created_at).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                Active: {conv.is_active ? 'Yes' : 'No'}
              </Typography>
            </CardContent>
            <CardActions>
              <Button component={RouterLink} to={`/conversation/${conv.id}`} size="small">
                Open
              </Button>
            </CardActions>
          </Card>
        ))}
      </List>
    </Box>
  );
}
