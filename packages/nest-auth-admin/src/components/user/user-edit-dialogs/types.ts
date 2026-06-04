import type { User } from '../../../types';

/** Shared props for user detail “edit” modals */
export interface EditModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (updates: Partial<User> & { tenantIds?: string[]; tenantRoles?: { tenantId: string; roleIds: string[] }[]; roleIds?: string[] }) => Promise<void>;
    user: User;
    loading?: boolean;
}
