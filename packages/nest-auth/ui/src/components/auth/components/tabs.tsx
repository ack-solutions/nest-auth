import React from 'react';
import { Tabs as MuiTabs, Tab, Box } from '@mui/material';

interface TabItem {
    id: string;
    label: string;
}

interface TabsProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
    const value = tabs.findIndex((t) => t.id === activeTab);
    return (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <MuiTabs value={value >= 0 ? value : 0} onChange={(_, v) => onTabChange(tabs[v]?.id ?? tabs[0].id)}>
                {tabs.map((tab) => (
                    <Tab key={tab.id} label={tab.label} sx={{ flex: 1, minHeight: 42 }} />
                ))}
            </MuiTabs>
        </Box>
    );
};
