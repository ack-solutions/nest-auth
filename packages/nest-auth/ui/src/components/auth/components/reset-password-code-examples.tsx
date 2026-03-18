import React from 'react';
import { AlertCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { Box, Stack, Typography } from '@mui/material';
import { CodeBlock } from './code-block';
import { PasswordRequirements } from './password-requirements';
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
        <Stack spacing={3}>
            <Box
                sx={{
                    p: 2,
                    bgcolor: 'warning.light',
                    border: '1px solid',
                    borderColor: 'warning.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                }}
            >
                <Icon component={AlertCircle} sx={{ fontSize: 20, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
                <Box>
                    <Typography variant="body2" fontWeight="600" color="warning.dark" sx={{ mb: 0.5 }}>Security Required</Typography>
                    <Typography variant="body2" color="warning.dark">
                        Password reset requires your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>. Configure it in your AuthModuleOptions (can be hardcoded or loaded from any environment variable).
                    </Typography>
                </Box>
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>Option 1: Using API (Recommended)</Typography>
                <CodeBlock id="reset-api-curl" code={resetPasswordCurlCode} />
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>Option 2: Using JavaScript/TypeScript</Typography>
                <CodeBlock id="reset-api-js" code={resetPasswordJsCode} />
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>Option 3: Direct Database Update (if API unavailable)</Typography>
                <CodeBlock id="reset-db" code={resetPasswordDbCode} />
            </Box>

            <PasswordRequirements />

            <Box sx={{ p: 2, bgcolor: 'success.light', border: '1px solid', borderColor: 'success.main', borderRadius: 1 }}>
                <Typography variant="body2" color="success.dark">
                    <strong>Secure:</strong> Password reset requires your private secret key, ensuring only authorized
                    personnel can reset passwords.
                </Typography>
            </Box>
        </Stack>
    );
};
