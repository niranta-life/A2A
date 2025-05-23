import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { format } from 'date-fns'; // For formatting dates, if not already available or preferred

// fileBaseUrl is the prefix like 'http://localhost:3001/message/file/'
// This is passed down from apiService.getFileUrl() structure
// However, apiService.getFileUrl(fileId) returns the *full* URL, so we don't need fileBaseUrl prop here.
// We'll assume apiService.getFileUrl is available globally or passed via context/props if used directly here.
// For simplicity, we can just use the full URL directly if a part provides it, or construct it if only ID is given.

// Let's assume apiService is imported in the parent and getFileUrl is called there,
// or the message part itself contains a pre-formatted URL or enough info.
// For this component, we'll assume 'content' is an array of parts like:
// [{ type: 'text', text: 'Hello' }, { type: 'file', fileId: 'xyz', name: 'image.png', mimeType: 'image/png', url: '...' }]
// The backend currently stores content as JSON string of such parts.
// The parent component (ConversationDetailPage) will parse this JSON string.

export default function ChatBubble({ message, currentUserId = 'user' /* to determine alignment */ }) {
  const isUser = message.role === currentUserId; // 'user' or 'agent' typically
  const align = isUser ? 'right' : 'left';
  const paperElevation = 2;

  const renderContentPart = (part, index) => {
    if (part.type === 'text') {
      return (
        <Typography variant="body1" component="span" key={index} sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {part.text}
        </Typography>
      );
    } else if (part.type === 'file_id' && part.file_id) { // Assuming backend sends file_id
        // The actual URL should be constructed in the parent or service layer
        // For now, just display info or a placeholder if URL isn't readily available in 'part'
        const fileName = part.name || `file_${part.file_id}`;
        const fileUrl = part.url || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001/message/file/${part.file_id}` : `/message/file/${part.file_id}`);
        
        if (part.mime_type && part.mime_type.startsWith('image/')) {
            return (
                <Box key={index} sx={{ my: 1 }}>
                    <Typography variant="caption" display="block">Attachment: {fileName}</Typography>
                    <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }} />
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
        <Box component="pre" key={index} sx={{ backgroundColor: 'grey.200', p: 1, borderRadius: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <code>{part.text}</code>
        </Box>
      );
    } else if (part.type === 'tool_output') {
         return (
            <Box component="pre" key={index} sx={{ backgroundColor: 'grey.100', p: 1, my:1, borderRadius: 1, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <Typography variant="caption" display="block">Tool Output:</Typography>
                <code>{part.text}</code>
            </Box>
        );
    }
    // Add more part types as needed (e.g., images, tool calls/outputs)
    return null;
  };

  // Ensure message.content is an array. If it's a string, it might need parsing (should be done by parent).
  const contentParts = Array.isArray(message.content) ? message.content : [];
  if (!Array.isArray(message.content)) {
      console.warn("ChatBubble received message.content that is not an array:", message);
  }


  return (
    <Box sx={{ display: 'flex', justifyContent: align, my: 1 }}>
      <Paper
        elevation={paperElevation}
        sx={{
          p: 1.5,
          maxWidth: '75%',
          bgcolor: isUser ? 'primary.light' : 'background.paper',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: isUser ? '15px 15px 5px 15px' : '15px 15px 15px 5px',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            {contentParts.map(renderContentPart)}
            <Typography variant="caption" sx={{ mt: 0.5, opacity: 0.7, display: 'block', textAlign: align }}>
            {message.role} - {message.created_at ? format(new Date(message.created_at), 'p') : 'sending...'}
            </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
