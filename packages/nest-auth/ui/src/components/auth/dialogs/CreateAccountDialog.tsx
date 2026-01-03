import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { Modal } from '../../Modal';
import { Tabs } from '../components/Tabs';
import { CreateAccountCodeExamples } from '../components/CreateAccountCodeExamples';
import { CreateAccountFormComponent } from '../forms/CreateAccountForm';
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
            isOpen={open}
            title="Create Admin Account"
            description="Use your Nest Auth Secret Key to create an admin account"
            icon={<Terminal className="w-6 h-6 text-primary-600" />}
            onClose={handleClose}
            tabs={
                <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'form' | 'code')} />
            }
            animate={true}
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
