import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface PageHeaderProps {
    title: string;
    description: string;
    onRefresh?: () => void;
    loading?: boolean;
    action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    onRefresh,
    loading,
    action,
}) => {
    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                <p className="text-gray-600 mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-3">
                {onRefresh && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </Button>
                )}
                {action}
            </div>
        </div>
    );
};
