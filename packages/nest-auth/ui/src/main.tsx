import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app-1';
import { ThemeProvider } from './theme';
import './index.css';
import { SettingsProvider } from './theme/settings/settings-provider';

const root = document.getElementById('root');
if (root) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <SettingsProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </SettingsProvider>
        </React.StrictMode>
    );
}
