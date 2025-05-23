import React, { useState, useEffect, useCallback } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';

import * as apiService from '../services/apiService';
import websocketService from '../services/websocketService';

export default function AgentListPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newAgentUrl, setNewAgentUrl] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listAgents();
      setAgents(data || []); // Ensure data is not null/undefined
    } catch (err) {
      console.error("Error fetching agents:", err);
      setError(err.message || 'Failed to fetch agents.');
      setAgents([]); // Clear agents on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    // Connect WebSocket on mount
    if (websocketService.getReadyState() !== WebSocket.OPEN) {
        websocketService.connect();
    }

    const handleWebSocketMessage = (message) => {
      if (message.type === 'agent_registered') {
        console.log('WebSocket: Agent registered event received', message.data);
        // For a more robust update, you could merge this new agent
        // into the existing list or re-fetch.
        // For now, just re-fetching.
        fetchAgents();
      }
      // Can handle other types of messages here
    };

    websocketService.onMessage(handleWebSocketMessage);

    // Cleanup on unmount
    return () => {
      websocketService.offMessage(handleWebSocketMessage);
      // Optional: Disconnect WebSocket if not used by other components
      // websocketService.disconnect(); 
    };
  }, [fetchAgents]); // Add fetchAgents to dependencies

  const handleRegisterAgent = async (event) => {
    event.preventDefault(); // Prevent form submission from reloading the page
    if (!newAgentUrl.trim()) {
      setRegistrationError("Agent URL cannot be empty.");
      return;
    }
    setIsRegistering(true);
    setRegistrationError(null);
    setError(null); // Clear main page error
    try {
      const newAgent = await apiService.registerAgent(newAgentUrl);
      console.log('New agent registered:', newAgent);
      setNewAgentUrl(''); // Clear the input field
      // The WebSocket event should ideally handle the list update.
      // fetchAgents(); // Or optimistically add to list: setAgents(prev => [newAgent, ...prev]);
    } catch (err) {
      console.error("Error registering agent:", err);
      setRegistrationError(err.message || 'Failed to register agent.');
    } finally {
      setIsRegistering(false);
    }
  };
  
  if (loading && agents.length === 0) { // Show loading only on initial load
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Agents
      </Typography>

      <Paper component="form" onSubmit={handleRegisterAgent} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Register New Agent</Typography>
        <TextField
          label="Agent URL (e.g., http://localhost:1234/agent)"
          variant="outlined"
          fullWidth
          value={newAgentUrl}
          onChange={(e) => setNewAgentUrl(e.target.value)}
          sx={{ mb: 1 }}
          disabled={isRegistering}
        />
        {registrationError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setRegistrationError(null)}>
            {registrationError}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isRegistering || !newAgentUrl.trim()}
          startIcon={<AppRegistrationIcon />}
        >
          {isRegistering ? 'Registering...' : 'Register Agent'}
        </Button>
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && <Typography sx={{my: 2}}>Refreshing list...</Typography>}

      {agents.length === 0 && !loading && !error && (
        <Typography sx={{mt: 2}}>No agents registered yet. Register one to get started!</Typography>
      )}

      <List>
        {agents.map((agent) => (
          <Card key={agent.id} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" component="div">
                {agent.name || `Agent ${agent.id.substring(0,8)}`}
              </Typography>
              <Typography sx={{ mb: 0.5 }} color="text.secondary">
                ID: {agent.id}
              </Typography>
              <Typography sx={{ mb: 0.5 }} variant="body2" color="text.secondary">
                URL: {agent.url}
              </Typography>
              <Typography variant="body2">
                Description: {agent.description || 'No description provided.'}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{mt:1}}>
                Registered: {new Date(agent.created_at).toLocaleString()}
              </Typography>
              {agent.icon && (
                 <Box sx={{mt:1, display: 'flex', alignItems: 'center'}}>
                    <Typography variant="caption" sx={{mr: 0.5}}>Icon:</Typography>
                    <img src={agent.icon} alt={`${agent.name} icon`} style={{width: 24, height: 24, border: '1px solid #ddd'}}/>
                 </Box>
              )}
            </CardContent>
            {/* Add CardActions here if needed, e.g., for an "Unregister" button later */}
          </Card>
        ))}
      </List>
    </Box>
  );
}
