import React from 'react';
import { Routes, Route } from 'react-router-dom';

import PageScaffold from './components/PageScaffold';
import HomePage from './pages/HomePage';
import ConversationListPage from './pages/ConversationListPage';
import ConversationDetailPage from './pages/ConversationDetailPage';
import AgentListPage from './pages/AgentListPage';
import TaskListPage from './pages/TaskListPage';
import SettingsPage from './pages/SettingsPage';
// import NotFoundPage from './pages/NotFoundPage'; // Example for a 404 page

// import './App.css'; // Removed as it's not present and MUI handles base styling

function App() {
  return (
    <Routes>
      <Route path="/" element={<PageScaffold />}>
        <Route index element={<HomePage />} />
        <Route path="conversations" element={<ConversationListPage />} />
        <Route path="conversation/:id" element={<ConversationDetailPage />} />
        <Route path="agents" element={<AgentListPage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Route>
    </Routes>
  );
}

export default App;
