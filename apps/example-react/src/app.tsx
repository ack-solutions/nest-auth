/**
 * Main Application Component
 * 
 * Defines the routing structure and main layout.
 * Separates public routes (login, signup) from protected routes (dashboard, profile).
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from './context/auth-context';
import { needsTenantSelectionFromUserAccesses } from './utils/tenant-access';

// Layout
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages (no auth required)
import LoginPage from './pages/auth/LoginPage';
import SelectTenantPage from './pages/auth/SelectTenantPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MfaVerifyPage from './pages/MfaVerifyPage';

// Protected Pages (auth required)
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import SecurityPage from './pages/SecurityPage';
import SessionsPage from './pages/SessionsPage';

/**
 * Loading screen shown while checking initial auth state
 */
function LoadingScreen() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <CircularProgress size={48} />
    </Box>
  );
}

/**
 * Main App Component
 * 
 * Route structure:
 * - / -> Redirect to dashboard if logged in, login otherwise
 * - /login -> Login page
 * - /signup -> Registration page
 * - /forgot-password -> Password reset request
 * - /reset-password -> Password reset with token/OTP
 * - /mfa-verify -> MFA verification during login
 * - /dashboard -> Protected dashboard
 * - /profile -> Protected profile page
 * - /security -> Protected security settings (password, MFA)
 * - /sessions -> Protected session management
 */
function App() {
  const { status, isAuthenticated, user } = useAuth();
  const needsTenantSelection = needsTenantSelectionFromUserAccesses(user?.userAccesses);

  // Show loading while determining auth state
  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* ============================================ */}
      {/* Public Routes - No authentication required  */}
      {/* ============================================ */}

      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to={needsTenantSelection ? '/select-tenant' : '/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={needsTenantSelection ? '/select-tenant' : '/dashboard'} replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Signup */}
      <Route
        path="/signup"
        element={
          isAuthenticated ? (
            <Navigate to={needsTenantSelection ? '/select-tenant' : '/dashboard'} replace />
          ) : (
            <SignupPage />
          )
        }
      />

      {/* Tenant selection */}
      <Route
        path="/select-tenant"
        element={
          isAuthenticated ? (
            <SelectTenantPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Forgot Password */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Reset Password (with token/OTP) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* MFA Verification (during login flow) */}
      <Route path="/mfa-verify" element={<MfaVerifyPage />} />

      {/* ============================================ */}
      {/* Protected Routes - Authentication required  */}
      {/* ============================================ */}

      {/* Wrap protected routes in Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard - Main landing page after login */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Profile - View and edit user profile */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Security - Change password, MFA settings */}
        <Route path="/security" element={<SecurityPage />} />

        {/* Sessions - View and manage active sessions */}
        <Route path="/sessions" element={<SessionsPage />} />
      </Route>

      {/* 404 - Redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
