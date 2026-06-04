import React from 'react';
import { AlertCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { Box, Stack, Typography } from '@mui/material';
import { CodeBlock } from './code-block';
import { PasswordRequirements } from './password-requirements';
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
                    <Typography variant="body2" fontWeight="600" color="warning.dark" sx={{ mb: 0.5 }}>Security Requirement</Typography>
                    <Typography variant="body2" color="warning.dark">
                        You need your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>. This key is required for admin console security operations.
                        Configure it in your AuthModuleOptions (can be hardcoded or loaded from any environment variable).
                    </Typography>
                </Box>
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>Using cURL</Typography>
                <CodeBlock id="signup-curl" code={signupCurlCode} />
            </Box>

            <Box>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5 }}>Using JavaScript/TypeScript</Typography>
                <CodeBlock id="signup-js" code={signupJsCode} />
            </Box>

            <PasswordRequirements />
        </Stack>
    );
};
