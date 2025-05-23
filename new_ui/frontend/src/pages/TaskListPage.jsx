import React, { useState, useEffect, useCallback } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { format } from 'date-fns';

import * as apiService from '../services/apiService';
import websocketService from '../services/websocketService';

// Helper to render individual artifact content parts
const RenderArtifactContentPart = ({ part, index }) => {
    if (part.type === 'text') {
      return (
        <Typography variant="body2" component="span" key={index} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {part.text}
        </Typography>
      );
    } else if (part.type === 'file_id' && part.file_id) {
        const fileName = part.name || `file_${part.file_id}`;
        // Construct file URL (assuming apiService.getFileUrl is available or similar logic)
        const fileUrl = apiService.getFileUrl(part.file_id);
        
        if (part.mime_type && part.mime_type.startsWith('image/')) {
            return (
                <Box key={index} sx={{ my: 1 }}>
                    <Typography variant="caption" display="block">Attachment: {fileName}</Typography>
                    <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }} />
                </Box>
            );
        } else {
            return (
                <Box key={index} sx={{ my: 1 }}>
                    <Typography variant="caption" display="block">Attachment:</Typography>
                    <Link href={fileUrl} target="_blank" rel="noopener noreferrer">
                        {fileName} ({part.mime_type || 'file'})
                    </Link>
                </Box>
            );
        }
    } else if (part.type === 'tool_code') {
      return (
        <Box component="pre" key={index} sx={{ backgroundColor: 'grey.200', p: 1, my: 0.5, borderRadius: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <Typography variant="caption" display="block" sx={{fontWeight: 'bold'}}>Tool Code:</Typography>
          <code>{part.text}</code>
        </Box>
      );
    } else if (part.type === 'tool_output') {
         return (
            <Box component="pre" key={index} sx={{ backgroundColor: 'grey.100', p: 1, my: 0.5, borderRadius: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <Typography variant="caption" display="block" sx={{fontWeight: 'bold'}}>Tool Output:</Typography>
                <code>{part.text}</code>
            </Box>
        );
    }
    return <Typography key={index} variant="caption">Unsupported part type: {part.type}</Typography>;
};


export default function TaskListPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listTasks(); // Fetch all tasks
      // Backend already parses state_details and artifact content for /task/list
      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err.message || 'Failed to fetch tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (websocketService.getReadyState() !== WebSocket.OPEN && websocketService.getReadyState() !== WebSocket.CONNECTING) {
      websocketService.connect();
    }

    const handleWebSocketMessage = (message) => {
      if (message.type === 'task_updated') {
        console.log('WebSocket: Task updated event received', message.data);
        setTasks(prevTasks => {
          const updatedTask = message.data;
          const existingTaskIndex = prevTasks.findIndex(t => t.id === updatedTask.id);
          if (existingTaskIndex !== -1) {
            const newTasks = [...prevTasks];
            newTasks[existingTaskIndex] = updatedTask;
            return newTasks;
          }
          // If task is new and from a different conversation (not currently filtered),
          // it might be added here. Or simply prepend/append.
          return [updatedTask, ...prevTasks.filter(t => t.id !== updatedTask.id)];
        });
      }
    };

    websocketService.onMessage(handleWebSocketMessage);

    return () => {
      websocketService.offMessage(handleWebSocketMessage);
    };
  }, []);

  if (loading && tasks.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Tasks Overview
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {loading && <Typography sx={{my: 2}}>Refreshing list...</Typography>}

      {tasks.length === 0 && !loading && !error && (
        <Typography sx={{mt: 2}}>No tasks found.</Typography>
      )}

      {tasks.map((task) => (
        <Accordion key={task.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ flexBasis: '40%', flexShrink: 0 }}>
                Task ID: {task.id.substring(0, 8)}...
              </Typography>
              <Typography variant="subtitle2" sx={{ flexBasis: '30%'}}>Status: {task.status}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '30%', textAlign:'right' }}>
                Conv: {task.conversation_id.substring(0,8)}...
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ width: '100%' }}>
              <Typography variant="body2">
                <strong>Full Task ID:</strong> {task.id}
              </Typography>
              <Typography variant="body2">
                <strong>Conversation ID:</strong> {task.conversation_id}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {task.status}
              </Typography>
              <Typography variant="body2">
                <strong>Created:</strong> {format(new Date(task.created_at), 'Pp')}
              </Typography>
              <Typography variant="body2">
                <strong>Updated:</strong> {format(new Date(task.updated_at), 'Pp')}
              </Typography>
              <Box sx={{ my: 1, p:1, border: '1px solid #eee', borderRadius: 1}}>
                <Typography variant="subtitle2" gutterBottom>State Details:</Typography>
                <Box component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY:'auto', backgroundColor:'grey.50', p:1 }}>
                  {task.state_details ? JSON.stringify(task.state_details, null, 2) : 'No details'}
                </Box>
              </Box>

              {task.artifacts && task.artifacts.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Artifacts ({task.artifacts.length}):</Typography>
                  {task.artifacts.map((artifact, index) => (
                    <Box key={artifact.id || index} sx={{ border: '1px dashed #ccc', p: 1, mb: 1, borderRadius: 1 }}>
                      <Typography variant="caption">
                        Artifact ID: {artifact.id.substring(0,8)}... (Ref: {artifact.artifact_id_ref || 'N/A'})
                      </Typography>
                      {Array.isArray(artifact.content) ? artifact.content.map((part, partIndex) => (
                        <RenderArtifactContentPart key={partIndex} part={part} index={partIndex} />
                      )) : <Typography variant="body2">Invalid artifact content format.</Typography>}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
