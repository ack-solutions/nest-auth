import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
    code: string;
    id: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, id }) => {
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
        <div className="relative group">
            <div className="bg-gray-900 rounded-lg p-4 pr-12 overflow-x-auto">
                <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all">
                    <code>{code}</code>
                </pre>
            </div>
            <button
                type="button"
                onClick={copyToClipboard}
                className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                title="Copy to clipboard"
            >
                {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                )}
            </button>
        </div>
    );
};
