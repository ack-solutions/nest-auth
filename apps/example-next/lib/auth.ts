import { createNextAuthHelpers } from '@ackplus/nest-auth-react';

export const { getServerAuth, withAuth, createInitialState } = createNextAuthHelpers({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    accessTokenType: 'cookie',
    cookieNames: {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
    },
});
