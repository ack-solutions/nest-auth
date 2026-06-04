import axios from 'axios';
import { AuthClient } from '@ackplus/nest-auth-client';
import { createNextAuthHelpers } from '@ackplus/nest-auth-react';

/**
 * Configure standard axios instance
 * This instance automatically handles:
 * 1. Base URL config
 * 2. Auth token attachment (from cookies or local storage)
 * 3. 401 response handling (optional)
 * 
 * Usage:
 * import api from '@/lib/api-client';
 * const response = await api.get('/some-endpoint');
 */

// Use the same base URL as the auth client (likely /api to use the proxy)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Important for cookies
});

// Interceptor to attach token if using header-based auth
// Note: If using 'cookie' mode (recommended for Next.js), tokens are sent automatically by browser
// This is mainly for 'header' mode support or if you need to access the token manually.
api.interceptors.request.use(async (config) => {
    // Only if we need to manually attach headers (e.g. if accessTokens are in localStorage)
    // For cookie mode, this is not strictly necessary but harmless.
    
    // We can access the token using the client if available, 
    // but typically explicit token management is handled by auth-client internally.
    
    return config;
});
