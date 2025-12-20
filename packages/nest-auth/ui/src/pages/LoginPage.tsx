import React, { useState } from 'react';
import type { LoginForm } from '../components/auth/types';
import { LoginHeader } from '../components/auth/LoginHeader';
import { LoginFooter } from '../components/auth/LoginFooter';
import { LoginFormComponent } from '../components/auth/forms/LoginForm';
import { CreateAccountDialog } from '../components/auth/dialogs/CreateAccountDialog';
import { ForgotPasswordDialog } from '../components/auth/dialogs/ForgotPasswordDialog';

interface LoginPageProps {
    onLogin: (credentials: LoginForm) => Promise<void>;
    error?: string | null;
}

type DialogType = 'signup' | 'forgot' | null;

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error: externalError }) => {
    const [openDialog, setOpenDialog] = useState<DialogType>(null);

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <LoginHeader />

                <LoginFormComponent
                    onSubmit={onLogin}
                    error={externalError}
                    onOpenCreateAccount={() => setOpenDialog('signup')}
                    onOpenForgotPassword={() => setOpenDialog('forgot')}
                />

                <LoginFooter />
            </div>

            <CreateAccountDialog open={openDialog === 'signup'} onClose={() => setOpenDialog(null)} />

            <ForgotPasswordDialog open={openDialog === 'forgot'} onClose={() => setOpenDialog(null)} />
        </div>
    );
};
