import React from 'react';
import { Button } from './Button';

interface PanelHeaderProps {
    title: string;
    description: string;
    onRefresh: () => void;
    loading?: boolean;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
    title,
    description,
    onRefresh,
    loading = false,
}) => {
    return (
        <div className="panel-header">
            <div>
                <h2>{title}</h2>
                <p className="muted">{description}</p>
            </div>
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
        </div>
    );
};
