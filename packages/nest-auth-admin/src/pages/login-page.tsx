import React, { useState } from 'react';
import { Box } from '@mui/material';
import type { LoginForm } from '../components/auth/types';
import { LoginHeader } from '../components/auth/login-header';
import { LoginFooter } from '../components/auth/login-footer';
import { LoginFormComponent } from '../components/auth/forms/login-form';
import { CreateAccountDialog } from '../components/auth/dialogs/create-account-dialog';
import { ForgotPasswordDialog } from '../components/auth/dialogs/forgot-password-dialog';

interface LoginPageProps {
    onLogin: (credentials: LoginForm) => Promise<void>;
    error?: string | null;
}

type DialogType = 'signup' | 'forgot' | null;

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error: externalError }) => {
    const [openDialog, setOpenDialog] = useState<DialogType>(null);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe, #f3e8ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 448 }}>
                <LoginHeader />

                <LoginFormComponent
                    onSubmit={onLogin}
                    error={externalError}
                    onOpenCreateAccount={() => setOpenDialog('signup')}
                    onOpenForgotPassword={() => setOpenDialog('forgot')}
                />

                <LoginFooter />
            </Box>

            <CreateAccountDialog open={openDialog === 'signup'} onClose={() => setOpenDialog(null)} />

            <ForgotPasswordDialog open={openDialog === 'forgot'} onClose={() => setOpenDialog(null)} />
        </Box>
    );
};
