import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { Modal } from '../../Modal';
import { Tabs } from '../components/Tabs';
import { ResetPasswordCodeExamples } from '../components/ResetPasswordCodeExamples';
import { ResetPasswordFormComponent } from '../forms/ResetPasswordForm';
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
        <Modal
            isOpen={open}
            title="Reset Admin Password"
            description="Reset your password using email and Nest Auth Secret Key"
            icon={<Terminal className="w-6 h-6 text-primary-600" />}
            onClose={handleClose}
            tabs={
                <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'form' | 'code')} />
            }
            animate={true}
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
        </Modal>
    );
};
