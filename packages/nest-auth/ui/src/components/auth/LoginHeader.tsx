import React from 'react';
import { Shield } from 'lucide-react';

export const LoginHeader: React.FC = () => {
    return (
        <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4 shadow-lg">
                <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Nest Auth</h1>
            <p className="text-gray-600 mt-2">Admin Dashboard</p>
        </div>
    );
};
