export const eventDocs = `
## Events

The module emits events using \`@nestjs/event-emitter\`. You can listen to these events to trigger custom logic such as sending emails, logging, analytics, or creating related records.

### All Available Events

| Event Name | Constant | When Triggered | Description |
|------------|----------|----------------|-------------|
| \`nest_auth.registered\` | \`REGISTERED\` | After successful signup | User successfully registered |
| \`nest_auth.logged_in\` | \`LOGGED_IN\` | After successful login | User successfully logged in |
| \`nest_auth.two_factor_verified\` | \`TWO_FACTOR_VERIFIED\` | After 2FA verification | User completed 2FA verification |
| \`nest_auth.two_factor_code_sent\` | \`TWO_FACTOR_CODE_SENT\` | When 2FA code is sent | 2FA code sent to user |
| \`nest_auth.refresh_token\` | \`REFRESH_TOKEN\` | When token is refreshed | Access token refreshed |
| \`nest_auth.password_reset_requested\` | \`PASSWORD_RESET_REQUESTED\` | When password reset is requested | Password reset OTP sent |
| \`nest_auth.password_reset\` | \`PASSWORD_RESET\` | After password reset | Password successfully reset |
| \`nest_auth.logged_out\` | \`LOGGED_OUT\` | After logout | User logged out from session |
| \`nest_auth.logged_out_all\` | \`LOGGED_OUT_ALL\` | After logout all | User logged out from all sessions |
| \`email.verification.requested\` | \`EMAIL_VERIFICATION_REQUESTED\` | When email verification is requested | Email verification OTP sent |
| \`email.verified\` | \`EMAIL_VERIFIED\` | After email verification | Email successfully verified |
| \`nest_auth.user.created\` | \`USER_CREATED\` | When user is created via UserService | User created programmatically |
| \`nest_auth.user.updated\` | \`USER_UPDATED\` | When user is updated | User details updated |
| \`nest_auth.user.deleted\` | \`USER_DELETED\` | When user is deleted | User deleted |
| \`nest_auth.tenant.created\` | \`TENANT_CREATED\` | When tenant is created | Tenant created |
| \`nest_auth.tenant.updated\` | \`TENANT_UPDATED\` | When tenant is updated | Tenant updated |
| \`nest_auth.tenant.deleted\` | \`TENANT_DELETED\` | When tenant is deleted | Tenant deleted |
| \`nest_auth.access_key.created\` | \`ACCESS_KEY_CREATED\` | When access key is created | API access key created |
| \`nest_auth.access_key.deactivated\` | \`ACCESS_KEY_DEACTIVATED\` | When access key is deactivated | Access key deactivated |
| \`nest_auth.access_key.deleted\` | \`ACCESS_KEY_DELETED\` | When access key is deleted | Access key deleted |

---

## Event Payloads

### Authentication Events

#### REGISTERED
\`\`\`typescript
{
  user: NestAuthUser;              // The newly registered user
  tenantId?: string;               // Tenant ID if multi-tenant
  input: SignupRequestDto;         // Signup request data (includes custom fields)
  provider: BaseAuthProvider;      // Auth provider used (email, phone, etc.)
  session: SessionPayload;         // Created session
  tokens: AuthTokensResponseDto;   // Access & refresh tokens
  isRequiresMfa: boolean;          // Whether MFA is required
}
\`\`\`

#### LOGGED_IN
\`\`\`typescript
{
  user: NestAuthUser;              // The logged in user
  tenantId?: string;               // Tenant ID
  input: LoginRequestDto;          // Login request data
  provider: BaseAuthProvider;      // Auth provider used
  session: SessionPayload;         // Created session
  tokens: AuthTokensResponseDto;   // Access & refresh tokens
  isRequiresMfa: boolean;          // Whether MFA is required
}
\`\`\`

#### TWO_FACTOR_VERIFIED
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  input: Verify2faRequestDto;      // 2FA verification request (method, OTP, rememberDevice)
  session: SessionPayload;         // Updated session
  tokens: AuthTokensResponseDto;   // New access & refresh tokens
}
\`\`\`

#### TWO_FACTOR_CODE_SENT
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  method: MFAMethodEnum;           // Method used (email, sms, totp)
  code: string;                    // The OTP code (use this to send via email/SMS)
}
\`\`\`

#### PASSWORD_RESET_REQUESTED
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  input: ForgotPasswordRequestDto; // Forgot password request
  otp: NestAuthOTP;                // OTP entity with code
  provider: BaseAuthProvider;      // Auth provider
}
\`\`\`

#### PASSWORD_RESET
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  input: ResetPasswordRequestDto;  // Reset password request
}
\`\`\`

#### LOGGED_OUT
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  session: SessionPayload;         // The session that was logged out
  logoutType: 'user' | 'admin' | 'system';  // Type of logout
  reason?: string;                 // Optional reason for logout
}
\`\`\`

#### LOGGED_OUT_ALL
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  sessionIds: string[];            // IDs of all logged out sessions
  logoutType: 'user' | 'admin' | 'system';  // Type of logout
  reason?: string;                 // Optional reason
}
\`\`\`

#### EMAIL_VERIFICATION_REQUESTED
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
  otp: NestAuthOTP;                // OTP entity with code (use otp.code to send email)
}
\`\`\`

#### EMAIL_VERIFIED
\`\`\`typescript
{
  user: NestAuthUser;              // The user
  tenantId?: string;               // Tenant ID
}
\`\`\`

---

### User Management Events

#### USER_CREATED
\`\`\`typescript
{
  user: NestAuthUser;              // The created user
  tenantId?: string;               // Tenant ID
}
\`\`\`

#### USER_UPDATED
\`\`\`typescript
{
  user: NestAuthUser;              // The updated user
  tenantId?: string;               // Tenant ID
  updatedFields: string[];         // Array of field names that were updated
}
\`\`\`

#### USER_DELETED
\`\`\`typescript
{
  user: NestAuthUser;              // The deleted user
  tenantId?: string;               // Tenant ID
}
\`\`\`

---

### Tenant Events

#### TENANT_CREATED
\`\`\`typescript
{
  tenant: NestAuthTenant;          // The created tenant
}
\`\`\`

#### TENANT_UPDATED
\`\`\`typescript
{
  tenant: NestAuthTenant;          // The updated tenant
  updatedFields: string[];         // Array of field names that were updated
}
\`\`\`

#### TENANT_DELETED
\`\`\`typescript
{
  tenant: NestAuthTenant;          // The deleted tenant
}
\`\`\`

---

### Access Key Events

#### ACCESS_KEY_CREATED
\`\`\`typescript
{
  accessKey: NestAuthAccessKey;    // The created access key
  userId: string;                  // User ID
}
\`\`\`

#### ACCESS_KEY_DEACTIVATED
\`\`\`typescript
{
  accessKey: NestAuthAccessKey;    // The deactivated access key
  userId: string;                  // User ID
}
\`\`\`

#### ACCESS_KEY_DELETED
\`\`\`typescript
{
  accessKey: NestAuthAccessKey;    // The deleted access key
  userId: string;                  // User ID
}
\`\`\`

---

## Listening to Events

Create a service and use the \`@OnEvent\` decorator:

\`\`\`typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';

@Injectable()
export class NotificationService {
  constructor(private emailService: EmailService) {}

  @OnEvent(NestAuthEvents.REGISTERED)
  async handleUserRegistered(payload: any) {
    const { user, input } = payload;

    console.log('New user registered:', user.email);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, {
      name: input.firstName || user.email
    });

    // Save custom fields to your profile table
    if (input.firstName || input.lastName) {
      await this.profileService.create({
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName
      });
    }
  }

  @OnEvent(NestAuthEvents.EMAIL_VERIFICATION_REQUESTED)
  async handleEmailVerification(payload: any) {
    const { user, otp } = payload;

    console.log('Sending verification email to:', user.email);

    // Send email with OTP code
    await this.emailService.sendVerificationEmail(user.email, {
      code: otp.code,
      expiresAt: otp.expiresAt
    });
  }

  @OnEvent(NestAuthEvents.PASSWORD_RESET_REQUESTED)
  async handlePasswordResetRequested(payload: any) {
    const { user, otp } = payload;

    // Send password reset email with OTP
    await this.emailService.sendPasswordResetEmail(user.email, {
      code: otp.code,
      expiresAt: otp.expiresAt
    });
  }

  @OnEvent(NestAuthEvents.TWO_FACTOR_CODE_SENT)
  async handle2FACodeSent(payload: any) {
    const { user, method, code } = payload;

    if (method === 'sms') {
      // Send SMS
      await this.smsService.send(user.phone, \`Your 2FA code is: \${code}\`);
    } else if (method === 'email') {
      // Send email
      await this.emailService.send2FACode(user.email, code);
    }
  }

  @OnEvent(NestAuthEvents.LOGGED_IN)
  async handleLogin(payload: any) {
    const { user, session } = payload;

    // Log login for security audit
    await this.auditService.logLogin({
      userId: user.id,
      sessionId: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      timestamp: new Date()
    });
  }

  @OnEvent(NestAuthEvents.USER_UPDATED)
  async handleUserUpdated(payload: any) {
    const { user, updatedFields } = payload;

    // Clear cache for user
    await this.cacheService.clearUserCache(user.id);

    // Log the update
    console.log(\`User \${user.id} updated fields: \${updatedFields.join(', ')}\`);
  }
}
\`\`\`

---

## Common Use Cases

### Send Welcome Email on Registration
\`\`\`typescript
@OnEvent(NestAuthEvents.REGISTERED)
async sendWelcomeEmail(payload: any) {
  const { user, input } = payload;

  await this.emailService.send({
    to: user.email,
    subject: 'Welcome!',
    template: 'welcome',
    context: {
      name: input.firstName || user.email,
      verifyLink: \`https://yourapp.com/verify-email\`
    }
  });
}
\`\`\`

### Save Custom Profile Data
\`\`\`typescript
@OnEvent(NestAuthEvents.REGISTERED)
async createUserProfile(payload: any) {
  const { user, input } = payload;

  // Extract custom fields from input
  await this.userProfileRepository.save({
    userId: user.id,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    preferences: input.preferences
  });
}
\`\`\`

### Security Logging
\`\`\`typescript
@OnEvent(NestAuthEvents.LOGGED_IN)
async logUserLogin(payload: any) {
  const { user, session } = payload;

  await this.securityLogRepository.save({
    userId: user.id,
    event: 'LOGIN',
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    timestamp: new Date()
  });
}

@OnEvent(NestAuthEvents.PASSWORD_RESET)
async logPasswordReset(payload: any) {
  const { user } = payload;

  await this.securityLogRepository.save({
    userId: user.id,
    event: 'PASSWORD_RESET',
    timestamp: new Date()
  });

  // Send security alert email
  await this.emailService.sendSecurityAlert(user.email, {
    event: 'Password Reset',
    timestamp: new Date()
  });
}
\`\`\`

### Analytics Tracking
\`\`\`typescript
@OnEvent(NestAuthEvents.REGISTERED)
async trackRegistration(payload: any) {
  const { user, provider } = payload;

  await this.analyticsService.track({
    event: 'user_registered',
    userId: user.id,
    properties: {
      provider: provider.providerName,
      tenantId: user.tenantId,
      timestamp: new Date()
    }
  });
}
\`\`\`
`;
