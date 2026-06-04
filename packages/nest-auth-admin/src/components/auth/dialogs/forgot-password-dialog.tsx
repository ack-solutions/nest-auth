import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { Dialog } from '../../dialog';
import { Tabs } from '../components/tabs';
import { ResetPasswordCodeExamples } from '../components/reset-password-code-examples';
import { ResetPasswordFormComponent } from '../forms/reset-password-form';
import { getAdminApiBaseUrl } from '../utils/utils';

interface ForgotPasswordDialogProps {
    open: boolean;
    onClose: () => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({ open, onClose }) => {
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState<'form' | 'code'>('form');
    const [timeoutId, setTimeoutId] = useState<number | null>(null);

    const adminApiBaseUrl = getAdminApiBaseUrl();

    const handleClose = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }
        onClose();
        setActiveTab('form');
        setError('');
        setSuccess(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        };
    }, [timeoutId]);

    const handleSuccess = () => {
        setSuccess(true);
        const id = window.setTimeout(() => {
            handleClose();
        }, 3000);
        setTimeoutId(id);
    };

    const tabs = [
        { id: 'form', label: 'Reset Password' },
        { id: 'code', label: 'Other Ways' },
    ];

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            title="Reset Admin Password"
            subTitle="Reset your password using email and Nest Auth Secret Key"
            icon={<Icon component={Terminal} sx={{ fontSize: 24, color: 'primary.main' }} />}
            tabs={
                <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'form' | 'code')} />
            }
        >
            {activeTab === 'form' && (
                <ResetPasswordFormComponent
                    onSuccess={handleSuccess}
                    onError={setError}
                    error={error}
                    success={success}
                    adminApiBaseUrl={adminApiBaseUrl}
                />
            )}

            {activeTab === 'code' && <ResetPasswordCodeExamples />}
        </Dialog>
    );
};
