import React from 'react';

export const PasswordRequirements: React.FC = () => {
    return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</p>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Minimum 8 characters</li>
                <li>At least one uppercase letter (A-Z)</li>
                <li>At least one lowercase letter (a-z)</li>
                <li>At least one number (0-9)</li>
                <li>At least one special character (@$!%*?&)</li>
            </ul>
        </div>
    );
};
