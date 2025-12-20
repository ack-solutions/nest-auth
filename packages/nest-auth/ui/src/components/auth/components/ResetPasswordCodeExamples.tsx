import React from 'react';
import { AlertCircle } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { PasswordRequirements } from './PasswordRequirements';
import { getAdminApiBaseUrl } from '../utils/utils';

export const ResetPasswordCodeExamples: React.FC = () => {
    const adminApiBaseUrl = getAdminApiBaseUrl();

    const resetPasswordCurlCode = `curl -X POST ${adminApiBaseUrl}/reset-password \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@example.com",
    "secretKey": "your-nest-auth-secret-key",
    "newPassword": "NewSecurePassword123!"
  }'`;

    const resetPasswordJsCode = `const base = '${adminApiBaseUrl}'
const response = await fetch(base + '/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    secretKey: 'your-secret-key-from-config', // Use the value from adminConsole.secretKey
    newPassword: 'NewSecurePassword123!'
  })
});
const result = await response.json();
console.log(result);`;

    const resetPasswordDbCode = `-- Generate bcrypt hash first: https://bcrypt-generator.com/
UPDATE admin_users
SET password = '$2b$10$YOUR_BCRYPT_HASH_HERE'
WHERE email = 'admin@example.com';`;

    return (
        <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Security Required</p>
                    <p>
                        Password reset requires your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>. Configure it in your AuthModuleOptions (can be hardcoded or loaded from any environment variable).
                    </p>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Option 1: Using API (Recommended)</h4>
                <CodeBlock id="reset-api-curl" code={resetPasswordCurlCode} />
            </div>

            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Option 2: Using JavaScript/TypeScript</h4>
                <CodeBlock id="reset-api-js" code={resetPasswordJsCode} />
            </div>

            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Option 3: Direct Database Update (if API unavailable)
                </h4>
                <CodeBlock id="reset-db" code={resetPasswordDbCode} />
            </div>

            <PasswordRequirements />

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                    <strong>Secure:</strong> Password reset requires your private secret key, ensuring only authorized
                    personnel can reset passwords.
                </p>
            </div>
        </div>
    );
};
