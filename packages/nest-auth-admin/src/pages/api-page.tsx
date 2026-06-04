import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import { FileText, Download, AlertCircle, Settings, Code, Zap, Book } from 'lucide-react';
import MuiIcon from '@mui/material/Icon';
import { PageHeader } from '../components/page-header';
import { ScalarApiReferenceWrapper } from '../components/scalar-api-reference-wrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { configDocs } from '../data/config-docs';
import { exampleDocs } from '../data/example-docs';
import { eventDocs } from '../data/event-docs';
import { apiReferenceDocs } from '../data/api-reference-docs';
import { serviceReferenceDocs } from '../data/service-reference-docs';

// Import the spec - will be bundled by Vite
// The JSON file is generated during the swagger generation step
// Vite will handle JSON imports, but we need to handle the case where it doesn't exist
import specData from '../data/nest-auth.json';

type TabType = 'api' | 'config' | 'examples' | 'events' | 'api-reference' | 'services';

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter
                            {...props}
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                                margin: 0,
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                            }}
                        >
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code {...props} style={{ backgroundColor: 'var(--mui-palette-grey-200)', color: 'var(--mui-palette-grey-800)', borderRadius: 4, padding: '2px 4px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {children}
                        </code>
                    );
                },
                table({ children }) {
                    return (
                        <Box sx={{ overflowX: 'auto', my: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Box component="table" sx={{ minWidth: '100%', borderCollapse: 'collapse', '& tr': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                                {children}
                            </Box>
                        </Box>
                    );
                },
                thead({ children }) {
                    return <Box component="thead" sx={{ bgcolor: 'grey.50' }}>{children}</Box>;
                },
                th({ children }) {
                    return (
                        <Box component="th" scope="col" sx={{ px: 1.5, py: 1.5, textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {children}
                        </Box>
                    );
                },
                td({ children }) {
                    return <Box component="td" sx={{ px: 1.5, py: 1.5, whiteSpace: 'nowrap', fontSize: '0.875rem', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box>;
                },
                a({ href, children }) {
                    return (
                        <a href={href} style={{ color: 'var(--mui-palette-primary-main)', textDecoration: 'none' }} className="MuiTypography-root MuiLink-root" onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }} target="_blank" rel="noopener noreferrer">
                            {children}
                        </a>
                    );
                },
                h2({ children }) {
                    return <Typography component="h2" variant="h5" sx={{ fontWeight: 700, mt: 3, mb: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>{children}</Typography>;
                },
                h3({ children }) {
                    return <Typography component="h3" variant="h6" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>{children}</Typography>;
                },
                p({ children }) {
                    return <Typography component="p" sx={{ color: 'text.primary', lineHeight: 1.6, mb: 1.5 }}>{children}</Typography>;
                },
                ul({ children }) {
                    return <Box component="ul" sx={{ listStyle: 'disc', pl: 2, mb: 1.5, color: 'text.primary', '& li': { mb: 0.5 } }}>{children}</Box>;
                },
                li({ children }) {
                    return <Box component="li" sx={{ ml: 1 }}>{children}</Box>;
                },
                blockquote({ children }) {
                    return (
                        <Box component="blockquote" sx={{ borderLeft: '4px solid', borderColor: 'primary.main', pl: 1.5, py: 0.5, my: 1.5, bgcolor: 'primary.50', color: 'text.primary', fontStyle: 'italic', borderRadius: '0 4px 4px 0' }}>
                            {children}
                        </Box>
                    );
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

export const ApiPage: React.FC = () => {
    const [hasError, setHasError] = useState(false);
    const [spec, setSpec] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabType>('api');

    useEffect(() => {
        const loadedSpec: any = specData || {};
        if (!loadedSpec || !loadedSpec.paths || Object.keys(loadedSpec.paths || {}).length === 0) {
            setHasError(true);
        } else {
            setSpec(loadedSpec);
        }
    }, []);

    const handleDownload = () => {
        if (!spec) return;
        const dataStr = JSON.stringify(spec, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'nest-auth-api.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const tabs = [
        { id: 'api', label: 'API Explorer', icon: FileText },
        { id: 'config', label: 'Configuration', icon: Settings },
        { id: 'examples', label: 'Examples', icon: Code },
        { id: 'events', label: 'Events', icon: Zap },
        { id: 'api-reference', label: 'API Reference', icon: Book },
        { id: 'services', label: 'Services', icon: Code },
    ];

    return (
        <Stack spacing={3}>
            <PageHeader
                title="API Documentation"
                description="Comprehensive guide and interactive API documentation."
                action={
                    activeTab === 'api' && (
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={handleDownload}
                            disabled={hasError}
                            startIcon={<MuiIcon component={Download} />}
                        >
                            Download JSON
                        </Button>
                    )
                }
            />

            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v as TabType)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                {tabs.map((tab) => (
                        <Tab
                            key={tab.id}
                            value={tab.id}
                            label={tab.label}
                            icon={<MuiIcon component={tab.icon} sx={{ fontSize: 16 }} />}
                            iconPosition="start"
                        />
                ))}
            </Tabs>

            {activeTab === 'api' && (
                hasError ? (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                        <Alert severity="warning" icon={<MuiIcon component={AlertCircle} sx={{ fontSize: 20 }} />} sx={{ textAlign: 'left' }}>
                            <Typography variant="subtitle2" gutterBottom>API Documentation Not Available</Typography>
                            <Typography variant="body2">
                                The OpenAPI specification file could not be loaded. Make sure the OpenAPI spec has been generated by running the build process.
                            </Typography>
                        </Alert>
                    </Paper>
                ) : (
                    <>
                        <Alert severity="info" icon={<MuiIcon component={FileText} sx={{ fontSize: 20 }} />}>
                            <Typography variant="subtitle2" gutterBottom>Interactive API Documentation</Typography>
                            <Typography variant="body2">
                                This documentation is auto-generated from the OpenAPI specification. You can test endpoints directly from this page.
                                Click &quot;Download JSON&quot; to get the raw OpenAPI specification file for importing into Postman or other API tools.
                            </Typography>
                        </Alert>

                        {spec && <ScalarApiReferenceWrapper spec={spec} />}
                    </>
                )
            )}

            {activeTab === 'config' && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <MarkdownContent content={configDocs} />
                </Paper>
            )}

            {activeTab === 'examples' && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <MarkdownContent content={exampleDocs} />
                </Paper>
            )}

            {activeTab === 'events' && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <MarkdownContent content={eventDocs} />
                </Paper>
            )}

            {activeTab === 'api-reference' && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <MarkdownContent content={apiReferenceDocs} />
                </Paper>
            )}

            {activeTab === 'services' && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <MarkdownContent content={serviceReferenceDocs} />
                </Paper>
            )}
        </Stack>
    );
};
