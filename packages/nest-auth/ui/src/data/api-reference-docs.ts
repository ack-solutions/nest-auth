export const apiReferenceDocs = `
## Token Management Guide

### Understanding Token Modes

The authentication system supports two token delivery modes:

**Header Mode (Default)**: Tokens are returned in the response body. Frontend must store and send them with each request.

**Cookie Mode**: Tokens are stored in HTTP-only cookies. Browser automatically sends them with each request.

### Configuring Token Mode

Set \`accessTokenType\` in your NestAuthModule configuration:

\`\`\`typescript
NestAuthModule.forRoot({
  accessTokenType: 'header',  // or 'cookie'
  // ...
})
\`\`\`

### Frontend Token Management (Header Mode)

**1. Store Tokens Securely**
\`\`\`typescript
// After login/signup
const { accessToken, refreshToken } = response.data;

// Store in memory (most secure, lost on refresh)
let tokens = { accessToken, refreshToken };

// OR store in localStorage (persists, less secure)
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// OR use a secure library like js-cookie with httpOnly emulation
\`\`\`

**2. Send Access Token with Requests**
\`\`\`typescript
// Using Axios
const api = axios.create({
  baseURL: 'http://localhost:3000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});
\`\`\`

**3. Handle Token Refresh**
\`\`\`typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const refreshToken = localStorage.getItem('refreshToken');

      try {
        const { data } = await axios.post('/auth/refresh-token', {
          refreshToken
        });

        // Update tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Retry original request
        error.config.headers.Authorization = \`Bearer \${data.accessToken}\`;
        return axios.request(error.config);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
\`\`\`

### Frontend Token Management (Cookie Mode)

**1. Enable Credentials**
\`\`\`typescript
// Axios
const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true  // Send cookies with requests
});

// Fetch
fetch('/auth/login', {
  method: 'POST',
  credentials: 'include',  // Send cookies
  // ...
});
\`\`\`

**2. No Manual Token Storage Needed**
Tokens are automatically sent by the browser via cookies. No need to store or send tokens manually.

**3. Handle Refresh (Automatic)**
\`\`\`typescript
// Just retry the request, token refresh happens server-side
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
\`\`\`

---

## Authentication Endpoints

### POST /auth/signup

**Description**: Register a new user with email/password or phone/password.

**Authentication**: None required

**Request Body**:
\`\`\`typescript
{
  email?: string;      // Email address (required if phone not provided)
  phone?: string;      // Phone number (required if email not provided)
  password: string;    // Password (min 8 chars, must include uppercase, lowercase, number, special char)
  tenantId?: string;   // Optional tenant ID (uses default if not provided)

  // You can pass any additional custom fields
  firstName?: string;  // Custom field example
  lastName?: string;   // Custom field example
  // ... any other fields
}
\`\`\`

> **Note**: Custom fields (like \`firstName\`, \`lastName\`, etc.) are not stored directly in the user table. They are passed to the \`USER_REGISTERED\` event, where you can handle them via event listeners and save to your own tables.

**Response (Header Mode)**:
\`\`\`typescript
{
  message: string;           // "Signup successful"
  accessToken: string;       // JWT access token
  refreshToken: string;      // JWT refresh token
  isRequiresMfa: boolean;    // Whether MFA is required
}
\`\`\`

**Response (Cookie Mode)**:
\`\`\`typescript
{
  message: string;           // "Signup successful"
  isRequiresMfa: boolean;    // Whether MFA is required
}
// Tokens are set in HTTP-only cookies
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
\`\`\`

**Handling Custom Fields via Events**:
\`\`\`typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';

@Injectable()
export class UserProfileService {
  @OnEvent(NestAuthEvents.USER_REGISTERED)
  async handleUserRegistered(payload: any) {
    const { user, input } = payload;

    // Save custom fields to your profile table
    await this.profileRepository.save({
      userId: user.id,
      firstName: input.firstName,
      lastName: input.lastName,
      // ... other custom fields
    });
  }
}
\`\`\`

---

### POST /auth/login

**Description**: Authenticate user with email/password, phone/password, or SSO provider.

**Authentication**: None required

**Request Body**:
\`\`\`typescript
{
  providerName: string;         // 'email', 'phone', 'google', 'github', etc.
  credentials: {
    email?: string;             // For email provider
    password?: string;          // For email/phone provider
    phone?: string;             // For phone provider
    accessToken?: string;       // For SSO providers
  };
  tenantId?: string;            // Optional tenant ID
  createUserIfNotExists?: boolean; // Auto-create user for SSO (default: false)
}
\`\`\`

**Response**: Same as signup response

**Example Request (Email/Password)**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "providerName": "email",
    "credentials": {
      "email": "user@example.com",
      "password": "SecurePass123!"
    }
  }'
\`\`\`

**Example Request (SSO)**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "providerName": "google",
    "credentials": {
      "accessToken": "ya29.a0AfH6SMB..."
    },
    "createUserIfNotExists": true
  }'
\`\`\`

---

### POST /auth/refresh-token

**Description**: Refresh access token using refresh token.

**Authentication**: None required (uses refresh token)

**Request Body**:
\`\`\`typescript
{
  refreshToken: string;  // JWT refresh token
}
\`\`\`

**Response**: Same as login response (new tokens)

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/refresh-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
\`\`\`

---

### POST /auth/send-2fa-code

**Description**: Send 2FA code via email or SMS after initial login.

**Authentication**: Required (partial access token from login)

**Request Body**:
\`\`\`typescript
{
  method: "email" | "sms";  // Delivery method for 2FA code
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "2FA code sent successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/send-2fa-code \\
  -H "Authorization: Bearer <partial_access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "email"
  }'
\`\`\`

---

### POST /auth/verify-2fa

**Description**: Verify 2FA code to complete authentication.

**Authentication**: Required (partial access token from login)

**Request Body**:
\`\`\`typescript
{
  method: "email" | "sms" | "totp";  // Method used for 2FA
  otp: string;                        // 6-digit OTP code
  rememberDevice?: boolean;           // Optional: Trust this device for 30 days
}
\`\`\`

**Response (Header Mode)**:
\`\`\`typescript
{
  message: "2FA verification successful";
  accessToken: string;       // New full access token
  refreshToken: string;      // New refresh token
  trustToken?: string;       // Trust token (if rememberDevice=true)
}
\`\`\`

**Response (Cookie Mode)**:
\`\`\`typescript
{
  message: "2FA verification successful";
  trustToken?: string;       // Trust token for mobile apps
}
// Tokens set in cookies, trust token also set as cookie
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/verify-2fa \\
  -H "Authorization: Bearer <partial_access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "email",
    "otp": "123456",
    "rememberDevice": true
  }'
\`\`\`

**Mobile Apps (Header Mode)**:
\`\`\`bash
# On subsequent logins, send the trust token
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -H "x-nest-auth-trust-token: <trust_token>" \\
  -d '{...}'
\`\`\`

---

### POST /auth/logout

**Description**: Logout current session.

**Authentication**: Required

**Request Body**: None

**Response**:
\`\`\`typescript
{
  message: "Logged out successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/logout \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/logout-all

**Description**: Logout all sessions for the current user.

**Authentication**: Required

**Request Body**: None

**Response**:
\`\`\`typescript
{
  message: "Logged out from all devices successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/logout-all \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/change-password

**Description**: Change user password. Revokes all sessions and generates new tokens.

**Authentication**: Required

**Request Body**:
\`\`\`typescript
{
  currentPassword: string;  // Current password
  newPassword: string;      // New password
}
\`\`\`

**Response**: Same as login response (new tokens)

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/change-password \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewSecurePass456!"
  }'
\`\`\`

---

### POST /auth/forgot-password

**Description**: Request password reset. Sends OTP to email or phone.

**Authentication**: None required

**Request Body**:
\`\`\`typescript
{
  email?: string;       // Email (required if phone not provided)
  phone?: string;       // Phone (required if email not provided)
  tenantId?: string;    // Optional tenant ID
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "If the account exists, a password reset code has been sent"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/forgot-password \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com"
  }'
\`\`\`

---

### POST /auth/verify-forgot-password-otp

**Description**: Verify password reset OTP and receive reset token.

**Authentication**: None required

**Request Body**:
\`\`\`typescript
{
  email?: string;       // Email (required if phone not provided)
  phone?: string;       // Phone (required if email not provided)
  otp: string;          // 6-digit OTP from email/SMS
  tenantId?: string;    // Optional tenant ID
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "OTP verified successfully";
  resetToken: string;   // JWT token to use for password reset
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/verify-forgot-password-otp \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
\`\`\`

---

### POST /auth/reset-password-with-token

**Description**: Reset password using the reset token.

**Authentication**: None required (uses reset token)

**Request Body**:
\`\`\`typescript
{
  token: string;        // Reset token from verify-forgot-password-otp
  newPassword: string;  // New password
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "Password reset successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/reset-password-with-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "newPassword": "NewSecurePass789!"
  }'
\`\`\`

---

### GET /auth/user

**Description**: Get current authenticated user details.

**Authentication**: Required

**Response**:
\`\`\`typescript
{
  id: string;
  email?: string;
  phone?: string;
  isVerified: boolean;
  isMfaEnabled: boolean;
  tenantId?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: object;
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X GET http://localhost:3000/auth/user \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/send-email-verification

**Description**: Send email verification OTP.

**Authentication**: Required

**Request Body**: None

**Response**:
\`\`\`typescript
{
  message: "Verification email sent successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/send-email-verification \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/verify-email

**Description**: Verify email with OTP.

**Authentication**: Required

**Request Body**:
\`\`\`typescript
{
  otp: string;  // 6-digit OTP from email
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "Email verified successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/verify-email \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "otp": "123456"
  }'
\`\`\`

---

### GET /auth/client-config

**Description**: Get frontend client configuration (enabled auth methods, MFA status, etc.).

**Authentication**: None required

**Response**:
\`\`\`typescript
{
  registration: {
    enabled: boolean;
  };
  mfa: {
    enabled: boolean;
    required: boolean;
    methods: string[];
  };
  ssoProviders: string[];
  // ... other config
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X GET http://localhost:3000/auth/client-config
\`\`\`

---

## MFA Endpoints

### GET /auth/mfa/status

**Description**: Get MFA status for current user.

**Authentication**: Required

**Response**:
\`\`\`typescript
{
  isEnabled: boolean;           // Whether MFA is enabled for user
  verifiedMethods: string[];    // Methods user has verified and can use (EMAIL/SMS always available if configured, TOTP only if user has verified device)
  configuredMethods: string[];  // All methods configured in the application (methods user can potentially set up)
  allowUserToggle: boolean;     // Can user enable/disable MFA
  allowMethodSelection: boolean;
  totpDevices: Array<{
    id: string;
    deviceName: string;
    verified: boolean;
    lastUsedAt?: string;
    createdAt: string;
  }>;
  hasRecoveryCode: boolean;     // Has generated recovery code
}
\`\`\`

**Example Response**:
\`\`\`json
{
  "isEnabled": false,
  "verifiedMethods": ["email", "sms"],
  "configuredMethods": ["email", "sms", "totp"],
  "allowUserToggle": true,
  "allowMethodSelection": true,
  "totpDevices": [],
  "hasRecoveryCode": false
}
\`\`\`


**Example Request**:
\`\`\`bash
curl -X GET http://localhost:3000/auth/mfa/status \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/mfa/toggle

**Description**: Enable or disable MFA for user.

**Authentication**: Required

**Request Body**:
\`\`\`typescript
{
  enabled: boolean;  // true to enable, false to disable
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "MFA enabled successfully" | "MFA disabled successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/toggle \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "enabled": true
  }'
\`\`\`

---

### GET /auth/mfa/devices

**Description**: List registered TOTP devices.

**Authentication**: Required

**Response**:
\`\`\`typescript
Array<{
  id: string;
  deviceName: string;
  method: "totp";
  verified: boolean;
  lastUsedAt?: string;
  createdAt: string;
}>
\`\`\`

**Example Request**:
\`\`\`bash
curl -X GET http://localhost:3000/auth/mfa/devices \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### DELETE /auth/mfa/devices/:deviceId

**Description**: Remove a registered TOTP device.

**Authentication**: Required

**Response**:
\`\`\`typescript
{
  message: "MFA device removed successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X DELETE http://localhost:3000/auth/mfa/devices/abc123 \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/mfa/setup-totp

**Description**: Generate TOTP secret and QR code for authenticator app.

**Authentication**: Required

**Request Body**: None

**Response**:
\`\`\`typescript
{
  secret: string;   // Base32 secret for manual entry
  qrCode: string;   // Data URL of QR code image
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/setup-totp \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

**Usage Flow**:
1. Call \`setup-totp\` to get secret and QR code
2. Show QR code to user (they scan with Google Authenticator, etc.)
3. User enters 6-digit code from app
4. Call \`verify-totp-setup\` with secret and code

---

### POST /auth/mfa/verify-totp-setup

**Description**: Verify TOTP setup with code from authenticator app.

**Authentication**: Required

**Request Body**:
\`\`\`typescript
{
  secret: string;  // Secret from setup-totp
  otp: string;     // 6-digit code from authenticator app
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "Device setup successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/verify-totp-setup \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "JBSWY3DPEHPK3PXP",
    "otp": "123456"
  }'
\`\`\`

---

### POST /auth/mfa/generate-recovery-code

**Description**: Generate recovery code for MFA reset.

**Authentication**: Required

**Request Body**: None

**Response**:
\`\`\`typescript
{
  code: string;  // Recovery code to store securely
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/generate-recovery-code \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

---

### POST /auth/mfa/reset-totp

**Description**: Reset MFA using recovery code (if user lost access to devices).

**Authentication**: Required

**Request Body**:
\`\`\`typescript
{
  code: string;  // Recovery code from generate-recovery-code
}
\`\`\`

**Response**:
\`\`\`typescript
{
  message: "MFA reset successfully"
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/reset-totp \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "JBSWY3DPEHPK3PXP"
  }'
\`\`\`

---

## Common Use Cases

### Complete Login Flow with 2FA

**Step 1: Initial Login**
\`\`\`bash
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "providerName": "email",
    "credentials": {
      "email": "user@example.com",
      "password": "SecurePass123!"
    }
  }'
\`\`\`

**Response**:
\`\`\`json
{
  "message": "Login successful",
  "accessToken": "partial_token...",
  "refreshToken": "refresh_token...",
  "isRequiresMfa": true
}
\`\`\`

**Step 2: Send 2FA Code**
\`\`\`bash
curl -X POST http://localhost:3000/auth/send-2fa-code \\
  -H "Authorization: Bearer partial_token..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "email"
  }'
\`\`\`

**Step 3: Verify 2FA**
\`\`\`bash
curl -X POST http://localhost:3000/auth/verify-2fa \\
  -H "Authorization: Bearer partial_token..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "email",
    "otp": "123456",
    "rememberDevice": true
  }'
\`\`\`

**Response**:
\`\`\`json
{
  "message": "2FA verification successful",
  "accessToken": "full_access_token...",
  "refreshToken": "new_refresh_token...",
  "trustToken": "trust_token..."
}
\`\`\`

### Setup TOTP Authenticator

**Step 1: Get QR Code**
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/setup-totp \\
  -H "Authorization: Bearer <access_token>"
\`\`\`

**Step 2: User scans QR code with Google Authenticator**

**Step 3: Verify Setup**
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/verify-totp-setup \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "JBSWY3DPEHPK3PXP",
    "otp": "123456"
  }'
\`\`\`

**Step 4: Enable MFA**
\`\`\`bash
curl -X POST http://localhost:3000/auth/mfa/toggle \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "enabled": true
  }'
\`\`\`

### Password Reset Flow

**Step 1: Request Reset**
\`\`\`bash
curl -X POST http://localhost:3000/auth/forgot-password \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com"
  }'
\`\`\`

**Step 2: Verify OTP**
\`\`\`bash
curl -X POST http://localhost:3000/auth/verify-forgot-password-otp \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
\`\`\`

**Response**:
\`\`\`json
{
  "message": "OTP verified successfully",
  "resetToken": "reset_token..."
}
\`\`\`

**Step 3: Reset Password**
\`\`\`bash
curl -X POST http://localhost:3000/auth/reset-password-with-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "reset_token...",
    "newPassword": "NewSecurePass789!"
  }'
\`\`\`
`;
