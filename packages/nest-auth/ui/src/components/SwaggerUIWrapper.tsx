import React, { useRef, useState, lazy, Suspense } from 'react';
import { Search, Lock, X, List, Grid, Maximize2 } from 'lucide-react';
import 'swagger-ui-react/swagger-ui.css';

// Lazy load SwaggerUI to reduce initial bundle size
const SwaggerUI = lazy(() => import('swagger-ui-react'));

interface SwaggerUIWrapperProps {
    spec: any;
}

type DocExpansion = 'list' | 'full' | 'none';

export const SwaggerUIWrapper: React.FC<SwaggerUIWrapperProps> = ({ spec }) => {
    const swaggerSystemRef = useRef<any>(null);
    const [viewMode, setViewMode] = useState<DocExpansion>('list');
    const [filterText, setFilterText] = useState('');
    const [authDialogOpen, setAuthDialogOpen] = useState(false);
    const [bearerToken, setBearerToken] = useState('');

    // Filter the spec based on search text
    const filteredSpec = React.useMemo(() => {
        const searchLower = filterText?.toLowerCase().trim() || '';
        let filteredPaths: any = {};

        if (searchLower) {
            Object.entries(spec.paths || {}).forEach(([path, methods]: [string, any]) => {
                const pathMatches = path.toLowerCase().includes(searchLower);
                const filteredMethods: any = {};

                Object.entries(methods).forEach(([method, operation]: [string, any]) => {
                    const methodMatches = method.toLowerCase().includes(searchLower);
                    const summaryMatches = operation.summary?.toLowerCase().includes(searchLower);
                    const descMatches = operation.description?.toLowerCase().includes(searchLower);
                    const tagsMatch = operation.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));

                    if (pathMatches || methodMatches || summaryMatches || descMatches || tagsMatch) {
                        filteredMethods[method] = operation;
                    }
                });

                if (Object.keys(filteredMethods).length > 0) {
                    filteredPaths[path] = filteredMethods;
                }
            });
        } else {
            filteredPaths = { ...spec.paths };
        }

        return {
            openapi: spec.openapi,
            paths: filteredPaths,
            components: spec.components,
            servers: spec.servers,
        };
    }, [spec, filterText]);

    const handleSwaggerComplete = (system: any) => {
        swaggerSystemRef.current = system;
    };

    const handleAuthorize = () => {
        if (swaggerSystemRef.current && bearerToken) {
            const authActions = swaggerSystemRef.current.authActions;
            if (authActions) {
                authActions.authorize({
                    BearerAuth: {
                        name: 'BearerAuth',
                        schema: { type: 'http', scheme: 'bearer' },
                        value: bearerToken,
                    },
                });
            }
        }
        setAuthDialogOpen(false);
    };

    const handleLogout = () => {
        if (swaggerSystemRef.current) {
            const authActions = swaggerSystemRef.current.authActions;
            if (authActions) {
                authActions.logout(['BearerAuth']);
            }
        }
        setBearerToken('');
    };

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="card">
                <div className="space-y-4">
                    {/* Top row: Filter and Auth */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Filter by tag or endpoint..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="input-field pl-10 w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setAuthDialogOpen(true)}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <Lock className="w-4 h-4" />
                                {bearerToken ? 'Authorized' : 'Authorize'}
                            </button>
                            {bearerToken && (
                                <button
                                    onClick={handleLogout}
                                    className="btn-secondary text-red-600 hover:text-red-700"
                                >
                                    Logout
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom row: View Mode */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Display Mode</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('none')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'none'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Grid className="w-4 h-4" />
                                Collapsed
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'list'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('full')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'full'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Maximize2 className="w-4 h-4" />
                                Expanded
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Authorization Dialog */}
            {authDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Authorize</h3>
                            <button
                                onClick={() => setAuthDialogOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Enter your Bearer token to authorize API requests
                            </p>
                            <input
                                type="password"
                                value={bearerToken}
                                onChange={(e) => setBearerToken(e.target.value)}
                                placeholder="Enter your JWT token"
                                className="input-field w-full"
                                autoFocus
                            />
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setAuthDialogOpen(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAuthorize}
                                disabled={!bearerToken}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Authorize
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* No Results Message */}
            {filterText && Object.keys(filteredSpec.paths || {}).length === 0 && (
                <div className="card text-center py-8">
                    <p className="text-lg font-medium text-gray-900 mb-2">No results found</p>
                    <p className="text-sm text-gray-600">
                        No endpoints match your search "{filterText}". Try a different search term.
                    </p>
                </div>
            )}

            {/* Swagger UI */}
            {(!filterText || Object.keys(filteredSpec.paths || {}).length > 0) && (
                <div className="card p-0 overflow-hidden">
                    <style>{`
                        .swagger-ui {
                            font-family: system-ui, -apple-system, sans-serif;
                        }
                        .swagger-ui .models,
                        .swagger-ui section.models,
                        .swagger-ui .information-container,
                        .swagger-ui .info,
                        .swagger-ui .info .title,
                        .swagger-ui .info hgroup,
                        .swagger-ui .info .title small,
                        .swagger-ui .info h1,
                        .swagger-ui .info h2,
                        .swagger-ui .info h3,
                        .swagger-ui .info a,
                        .swagger-ui .info .base-url,
                        .swagger-ui .info .url,
                        .swagger-ui .scheme-container,
                        .swagger-ui .filter-container,
                        .swagger-ui .auth-wrapper,
                        .swagger-ui .authorization__btn,
                        .swagger-ui > div > div:first-child > div:first-child,
                        .swagger-ui .wrapper > .information-container {
                            display: none !important;
                        }
                        .swagger-ui .information-container * {
                            display: none !important;
                        }
                        .swagger-ui h4,
                        .swagger-ui h5 {
                            margin-bottom: 16px;
                        }
                        .swagger-ui .opblock.opblock-get .opblock-summary-method {
                            background: #3b82f6;
                        }
                        .swagger-ui .opblock.opblock-post .opblock-summary-method {
                            background: #10b981;
                        }
                        .swagger-ui .opblock.opblock-put .opblock-summary-method {
                            background: #f59e0b;
                        }
                        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
                            background: #ef4444;
                        }
                        .swagger-ui .opblock.opblock-patch .opblock-summary-method {
                            background: #8b5cf6;
                        }
                        .swagger-ui .btn.execute {
                            background: #3b82f6;
                            color: white;
                            border-color: #3b82f6;
                        }
                        .swagger-ui .btn.execute:hover {
                            background: #2563eb;
                            border-color: #2563eb;
                        }
                        .swagger-ui .opblock,
                        .swagger-ui input,
                        .swagger-ui textarea,
                        .swagger-ui select {
                            border-radius: 8px;
                        }
                        .swagger-ui {
                            padding: 20px;
                        }
                    `}</style>
                    <Suspense
                        fallback={
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Loading API documentation...</p>
                            </div>
                        }
                    >
                        <SwaggerUI
                            key={viewMode}
                            spec={filteredSpec}
                            docExpansion={viewMode}
                            defaultModelsExpandDepth={-1}
                            defaultModelExpandDepth={1}
                            displayOperationId={false}
                            filter={false}
                            showExtensions={false}
                            showCommonExtensions={false}
                            tryItOutEnabled={true}
                            persistAuthorization={true}
                            deepLinking={true}
                            displayRequestDuration={true}
                            onComplete={handleSwaggerComplete}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
};
