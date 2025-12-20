import React from 'react';
import { calculatePasswordStrength } from '../utils/security';

interface PasswordStrengthIndicatorProps {
    password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
    if (!password || password.length === 0) {
        return null;
    }

    const strength = calculatePasswordStrength(password);

    if (!strength) {
        return null;
    }

    const strengthColors = {
        weak: 'bg-red-500',
        medium: 'bg-yellow-500',
        strong: 'bg-green-500',
    };

    const strengthLabels = {
        weak: 'Weak',
        medium: 'Medium',
        strong: 'Strong',
    };

    return (
        <div className="mt-2">
            <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all ${strengthColors[strength]}`}
                        style={{
                            width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
                        }}
                    />
                </div>
                <span className={`text-xs font-medium ${strength === 'weak' ? 'text-red-600' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {strengthLabels[strength]}
                </span>
            </div>
        </div>
    );
};
