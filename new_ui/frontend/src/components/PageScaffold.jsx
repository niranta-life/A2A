import React from 'react';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// Import some icons for navigation (optional, but makes it look nicer)
import HomeIcon from '@mui/icons-material/Home';
import ChatIcon from '@mui/icons-material/Chat';
import PeopleIcon from '@mui/icons-material/People';
import TaskIcon from '@mui/icons-material/Assignment';
import SettingsIcon from '@mui/icons-material/Settings';

const drawerWidth = 240;

const navItems = [
  { text: 'Home', path: '/', icon: <HomeIcon /> },
  { text: 'Conversations', path: '/conversations', icon: <ChatIcon /> },
  { text: 'Agents', path: '/agents', icon: <PeopleIcon /> },
  { text: 'Tasks', path: '/tasks', icon: <TaskIcon /> },
  { text: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

export default function PageScaffold() {
  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px`, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            ADK Web UI
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: (theme) => theme.palette.background.paper, // Ensure drawer bg matches theme
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar /> {/* For spacing, to align content below the AppBar */}
        <List>
          {navItems.map((item) => (
            <ListItem key={item.text} disablePadding component={RouterLink} to={item.path} sx={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton>
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          bgcolor: (theme) => theme.palette.background.default, 
          p: 3, 
          marginLeft: `${drawerWidth}px`, // Ensure this is correct if drawer is not part of flex flow initially
          width: `calc(100% - ${drawerWidth}px)` // Ensure main content takes up remaining width
        }}
      >
        <Toolbar /> {/* Necessary to ensure content is below the AppBar */}
        <Outlet /> {/* Child routes will render here */}
      </Box>
    </Box>
  );
}
