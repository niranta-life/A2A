import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import SaveIcon from '@mui/icons-material/Save';

import * as apiService from '../services/apiService';

export default function SettingsPage() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  const handleUpdateApiKey = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccessMessage('');

    try {
      const response = await apiService.updateApiKey(apiKeyInput);
      setSaveSuccessMessage(response.message || 'API Key updated successfully!');
      // setApiKeyInput(''); // Optionally clear the input after successful save
    } catch (err) {
      console.error("Error updating API key:", err);
      setSaveError(err.message || 'Failed to update API key.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSaveSuccessMessage('');
  };

  return (
    <Box sx={{ p: 2, maxWidth: 600 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Paper component="form" onSubmit={handleUpdateApiKey} sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Host API Key
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Update the API key used for communicating with the Python ADK Host.
          This key will be included in the 'X-API-Key' header of requests to the host.
          Leave empty if no API key is required by the host.
        </Typography>
        <TextField
          label="Python ADK API Key"
          variant="outlined"
          fullWidth
          type="password" // Use password type to obscure the key
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          sx={{ mb: 2 }}
          disabled={isSaving}
          helperText="The API key will be stored in the backend server's memory and used for all subsequent requests to the host."
        />

        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
        >
          {isSaving ? 'Saving...' : 'Update API Key'}
        </Button>
      </Paper>

      <Snackbar
        open={!!saveSuccessMessage}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          {saveSuccessMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
