'use client';

import { AuthProvider as NestAuthProvider } from '@ackplus/nest-auth-react';
import { AuthClient } from '@ackplus/nest-auth-client';
import { ReactNode, useMemo } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
    const client = useMemo(() => new AuthClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        accessTokenType: 'cookie',
    }), []);

    return (
        <NestAuthProvider client={client}>
            {children as any}
        </NestAuthProvider>
    );
}
