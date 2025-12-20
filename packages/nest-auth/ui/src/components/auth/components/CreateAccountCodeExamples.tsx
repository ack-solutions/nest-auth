import React from 'react';
import { AlertCircle } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { PasswordRequirements } from './PasswordRequirements';
import { getAdminApiBaseUrl } from '../utils/utils';

export const CreateAccountCodeExamples: React.FC = () => {
    const adminApiBaseUrl = getAdminApiBaseUrl();

    const signupCurlCode = `curl -X POST ${adminApiBaseUrl}/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@example.com",
    "name": "Admin User",
    "password": "YourSecurePassword123!",
    "secretKey": "your-nest-auth-secret-key"
  }'`;

    const signupJsCode = `const base = '${adminApiBaseUrl}'
const response = await fetch(base + '/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'YourSecurePassword123!',
    secretKey: 'your-secret-key-from-config' // Use the value from adminConsole.secretKey
  })
});
const result = await response.json();
console.log(result);`;

    return (
        <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Security Requirement</p>
                    <p>
                        You need your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>. This key is required for admin console security operations.
                        Configure it in your AuthModuleOptions (can be hardcoded or loaded from any environment variable).
                    </p>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Using cURL</h4>
                <CodeBlock id="signup-curl" code={signupCurlCode} />
            </div>

            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Using JavaScript/TypeScript</h4>
                <CodeBlock id="signup-js" code={signupJsCode} />
            </div>

            <PasswordRequirements />
        </div>
    );
};
