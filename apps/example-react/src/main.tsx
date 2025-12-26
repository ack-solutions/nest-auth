/**
 * Application Entry Point
 * 
 * Sets up the React application with all required providers:
 * - ThemeProvider: Material UI theming
 * - AuthProvider: nest-auth-react authentication
 * - BrowserRouter: React Router for navigation
 * - SnackbarProvider: Toast notifications
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '@ackplus/nest-auth-react';
import { AuthClient, LocalStorageAdapter, SessionStorageAdapter } from '@ackplus/nest-auth-client';

import App from './App';
import theme from './theme';
import './index.css';

/**
 * Auth Client Configuration
 * 
 * Configure the auth client to connect to the backend API.
 * In production, use environment variables for the API URL.
 */
const storageType = 'local' as const; // 'local' | 'session' | 'memory'

const authConfig = {
  /**
   * Backend API URL
   * Matches the example-nest app running on port 3000
   */
  baseUrl: 'http://localhost:3000/api',

  /**
   * Token mode: 'header' or 'cookie'
   * - 'header': Uses Authorization header (good for SPAs, React Native)
   * - 'cookie': Uses httpOnly cookies (more secure for web, handles CSRF)
   * - null: Auto-detect based on backend response
   */
  accessTokenType: 'header' as const,

  /**
   * Storage adapter for tokens (only relevant for header mode)
   * - LocalStorageAdapter: localStorage (persists across tabs/sessions)
   * - SessionStorageAdapter: sessionStorage (cleared on tab close)
   * - MemoryStorage: In-memory (cleared on page refresh)
   */
  storage: storageType === 'local' 
    ? new LocalStorageAdapter() 
    : storageType === 'session' 
    ? new SessionStorageAdapter() 
    : undefined, // Will use default MemoryStorage

  /**
   * Enable debug logging in development
   */
  logger: import.meta.env.DEV ? {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  } : undefined,
};

/**
 * Create AuthClient instance
 * This is passed to AuthProvider to enable authentication throughout the app
 */
const authClient = new AuthClient(authConfig);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Material UI Theme */}
    <ThemeProvider theme={theme}>
      {/* CSS Reset and baseline styles */}
      <CssBaseline />

      {/* Toast notifications */}
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        autoHideDuration={4000}
      >
        {/* Authentication context */}
        <AuthProvider client={authClient}>
          {/* React Router */}
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </StrictMode>,
);
