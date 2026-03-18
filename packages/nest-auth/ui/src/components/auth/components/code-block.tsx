import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Box, IconButton } from '@mui/material';

interface CodeBlockProps {
    code: string;
    id: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Clipboard write failed:', err);
        }
    };

    return (
        <Box sx={{ position: 'relative' }}>
            <Box
                sx={{
                    bgcolor: 'grey.900',
                    borderRadius: 1,
                    p: 2,
                    pr: 5,
                    overflowX: 'auto',
                }}
            >
                <Box
                    component="pre"
                    sx={{
                        typography: 'body2',
                        fontFamily: 'monospace',
                        color: 'grey.100',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        m: 0,
                    }}
                >
                    <code>{code}</code>
                </Box>
            </Box>
            <IconButton
                size="small"
                onClick={copyToClipboard}
                title="Copy to clipboard"
                sx={{
                    position: 'absolute',
                    top: 12,
                    right: 8,
                    bgcolor: 'grey.800',
                    color: 'grey.400',
                    '&:hover': { bgcolor: 'grey.700' },
                }}
            >
                {copied ? (
                    <Check style={{ width: 16, height: 16, color: 'var(--mui-palette-success-light)' }} />
                ) : (
                    <Copy style={{ width: 16, height: 16 }} />
                )}
            </IconButton>
        </Box>
    );
};
