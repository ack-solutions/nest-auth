import React, { useState, useEffect } from 'react';
import { FileText, Download, AlertCircle, Settings, Code, Zap, Book } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SwaggerUIWrapper } from '../components/SwaggerUIWrapper';
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

type TabType = 'swagger' | 'config' | 'examples' | 'events' | 'api-reference' | 'services';

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
                        <code {...props} className={`${className} bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-sm font-mono`}>
                            {children}
                        </code>
                    );
                },
                table({ children }) {
                    return (
                        <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                {children}
                            </table>
                        </div>
                    );
                },
                thead({ children }) {
                    return <thead className="bg-gray-50">{children}</thead>;
                },
                th({ children }) {
                    return (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {children}
                        </th>
                    );
                },
                td({ children }) {
                    return <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-t border-gray-200">{children}</td>;
                },
                a({ href, children }) {
                    return (
                        <a href={href} className="text-primary-600 hover:text-primary-800 hover:underline" target="_blank" rel="noopener noreferrer">
                            {children}
                        </a>
                    );
                },
                h2({ children }) {
                    return <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">{children}</h2>;
                },
                h3({ children }) {
                    return <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">{children}</h3>;
                },
                p({ children }) {
                    return <p className="text-gray-700 leading-relaxed mb-4">{children}</p>;
                },
                ul({ children }) {
                    return <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700">{children}</ul>;
                },
                li({ children }) {
                    return <li className="ml-4">{children}</li>;
                },
                blockquote({ children }) {
                    return (
                        <blockquote className="border-l-4 border-primary-500 pl-4 py-1 my-4 bg-primary-50 text-gray-700 italic rounded-r">
                            {children}
                        </blockquote>
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
    const [activeTab, setActiveTab] = useState<TabType>('swagger');

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
        { id: 'swagger', label: 'Interactive API', icon: FileText },
        { id: 'config', label: 'Configuration', icon: Settings },
        { id: 'examples', label: 'Examples', icon: Code },
        { id: 'events', label: 'Events', icon: Zap },
        { id: 'api-reference', label: 'API Reference', icon: Book },
        { id: 'services', label: 'Services', icon: Code },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="API Documentation"
                description="Comprehensive guide and interactive API documentation."
                action={
                    activeTab === 'swagger' && (
                        <button
                            onClick={handleDownload}
                            className="btn-secondary flex items-center gap-2"
                            disabled={hasError}
                        >
                            <Download className="w-4 h-4" />
                            Download JSON
                        </button>
                    )
                }
            />

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {activeTab === 'swagger' && (
                hasError ? (
                    <div className="card">
                        <div className="p-6 text-center">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 mb-4">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-left">
                                    <p className="font-semibold text-amber-900 mb-1">API Documentation Not Available</p>
                                    <p className="text-sm text-amber-800">
                                        The OpenAPI specification file could not be loaded. Make sure the Swagger spec has been generated by running the build process.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="card bg-blue-50 border-blue-200">
                            <div className="p-4 flex items-start gap-3">
                                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-900 mb-1">Interactive API Documentation</p>
                                    <p className="text-sm text-blue-800">
                                        This documentation is auto-generated from the OpenAPI specification. You can test endpoints directly from this page.
                                        Click "Download JSON" to get the raw OpenAPI specification file for importing into Postman or other API tools.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {spec && <SwaggerUIWrapper spec={spec} />}
                    </>
                )
            )}

            {activeTab === 'config' && (
                <div className="card p-8">
                    <div className="prose prose-blue max-w-none">
                        <MarkdownContent content={configDocs} />
                    </div>
                </div>
            )}

            {activeTab === 'examples' && (
                <div className="card p-8">
                    <div className="prose prose-blue max-w-none">
                        <MarkdownContent content={exampleDocs} />
                    </div>
                </div>
            )}

            {activeTab === 'events' && (
                <div className="card p-8">
                    <div className="prose prose-blue max-w-none">
                        <MarkdownContent content={eventDocs} />
                    </div>
                </div>
            )}

            {activeTab === 'api-reference' && (
                <div className="card p-8">
                    <div className="prose prose-blue max-w-none">
                        <MarkdownContent content={apiReferenceDocs} />
                    </div>
                </div>
            )}

            {activeTab === 'services' && (
                <div className="card p-8">
                    <div className="prose prose-blue max-w-none">
                        <MarkdownContent content={serviceReferenceDocs} />
                    </div>
                </div>
            )}
        </div>
    );
};
