import React, { useState, useEffect } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { Modal } from '../../modal';
import { Tabs } from '../components/tabs';
import { CreateAccountCodeExamples } from '../components/create-account-code-examples';
import { CreateAccountFormComponent } from '../forms/create-account-form';
import { getAdminApiBaseUrl } from '../utils/utils';

interface CreateAccountDialogProps {
    open: boolean;
    onClose: () => void;
}

export const CreateAccountDialog: React.FC<CreateAccountDialogProps> = ({ open, onClose }) => {
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
        }, 2000);
        setTimeoutId(id);
    };

    const tabs = [
        { id: 'form', label: 'Create Account' },
        { id: 'code', label: 'Other Ways' },
    ];

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Create Admin Account"
            subTitle="Use your Nest Auth Secret Key to create an admin account"
            icon={<AdminPanelSettingsIcon sx={{ fontSize: 24, color: 'primary.main' }} />}
            tabs={
                <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'form' | 'code')} />
            }
        >
            {activeTab === 'form' && (
                <CreateAccountFormComponent
                    onSuccess={handleSuccess}
                    onError={setError}
                    error={error}
                    success={success}
                    adminApiBaseUrl={adminApiBaseUrl}
                />
            )}

            {activeTab === 'code' && <CreateAccountCodeExamples />}

        </Modal>
    );
};
