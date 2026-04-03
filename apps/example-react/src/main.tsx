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
import { AuthClient, createAxiosAdapter, LocalStorageAdapter, SessionStorageAdapter } from '@ackplus/nest-auth-client';

import { AppAuthProvider } from './context/auth-provider';
import App from './app';
import theme from './theme';
import './index.css';
import { instanceApi } from './api/axios-instance';
import { config } from './config';

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
  baseUrl: config.apiBaseOrigin || '',

  /**
   * Token mode: 'header' or 'cookie'
   * - 'header': Uses Authorization header (good for SPAs, React Native)
   * - 'cookie': Uses httpOnly cookies (more secure for web, handles CSRF)
   * - null: Auto-detect based on backend response
   */
  accessTokenType: 'cookie' as const,

  httpAdapter: createAxiosAdapter(instanceApi),

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

const handleTokenSet = (tokens: { accessToken: string; refreshToken: string; trustToken?: string }) => {
  if (tokens?.accessToken) {
    instanceApi.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
  }
};

const handleTokenRemoved = () => {
  delete instanceApi.defaults.headers.common?.['Authorization'];
};

createRoot(document.getElementById('root')!).render(
  <>
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
        <AppAuthProvider
          client={authClient}
          onTokensSet={handleTokenSet}
          onTokensRemoved={handleTokenRemoved}
        >
          {/* React Router */}
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppAuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  </>,
);
