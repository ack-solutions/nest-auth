export const exampleDocs = `
## Usage Examples

This section provides complete, practical examples for common integration scenarios.

---

## Frontend Integration

### React Login Component (Header Mode)

\`\`\`typescript
import React, { useState } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [otp, setOtp] = useState('');
  const [partialToken, setPartialToken] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { data } = await api.post('/auth/login', {
        providerName: 'email',
        credentials: { email, password }
      });

      if (data.isRequiresMfa) {
        // User needs 2FA
        setPartialToken(data.accessToken);
        setNeeds2FA(true);
        // Send 2FA code
        await api.post('/auth/send-2fa-code',
          { method: 'email' },
          { headers: { Authorization: \`Bearer \${data.accessToken}\` }}
        );
      } else {
        // Login complete
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      alert('Login failed: ' + error.response?.data?.message);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();

    try {
      const { data } = await api.post('/auth/verify-2fa',
        {
          method: 'email',
          otp: otp,
          rememberDevice: true // Trust this device
        },
        { headers: { Authorization: \`Bearer \${partialToken}\` }}
      );

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      if (data.trustToken) {
        localStorage.setItem('trustToken', data.trustToken);
      }

      window.location.href = '/dashboard';
    } catch (error) {
      alert('Invalid code');
    }
  };

  if (needs2FA) {
    return (
      <form onSubmit={handleVerify2FA}>
        <h2>Enter 2FA Code</h2>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
\`\`\`

---

### Vue.js Registration Component

\`\`\`typescript
<template>
  <form @submit.prevent="handleSignup">
    <h2>Sign Up</h2>
    <input v-model="form.email" type="email" placeholder="Email" required />
    <input v-model="form.password" type="password" placeholder="Password" required />
    <input v-model="form.firstName" type="text" placeholder="First Name" />
    <input v-model="form.lastName" type="text" placeholder="Last Name" />
    <button type="submit">Sign Up</button>
  </form>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      form: {
        email: '',
        password: '',
        firstName: '',
        lastName: ''
      }
    };
  },
  methods: {
    async handleSignup() {
      try {
        const { data } = await axios.post('/auth/signup', {
          email: this.form.email,
          password: this.form.password,
          firstName: this.form.firstName,
          lastName: this.form.lastName
        });

        // Store tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Redirect to dashboard or verification page
        this.$router.push('/dashboard');
      } catch (error) {
        alert('Signup failed: ' + error.response?.data?.message);
      }
    }
  }
};
</script>
\`\`\`

---

### Angular Service (Cookie Mode)

\`\`\`typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:3000/auth';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(
      \`\${this.baseUrl}/login\`,
      {
        providerName: 'email',
        credentials: { email, password }
      },
      { withCredentials: true } // Include cookies
    );
  }

  signup(data: any): Observable<any> {
    return this.http.post(
      \`\${this.baseUrl}/signup\`,
      data,
      { withCredentials: true }
    );
  }

  logout(): Observable<any> {
    return this.http.post(
      \`\${this.baseUrl}/logout\`,
      {},
      { withCredentials: true }
    );
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(
      \`\${this.baseUrl}/user\`,
      { withCredentials: true }
    );
  }
}
\`\`\`

---

## Backend Integration

### Custom User Profile Service

Handle custom fields from registration using event listeners:

\`\`\`typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthEvents } from '@ackplus/nest-auth';

@Entity()
class UserProfile {
  @PrimaryColumn()
  userId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  companyName: string;

  @Column({ nullable: true })
  phoneNumber: string;
}

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private profileRepo: Repository<UserProfile>
  ) {}

  @OnEvent(NestAuthEvents.REGISTERED)
  async handleUserRegistered(payload: any) {
    const { user, input } = payload;

    // Save custom profile fields
    await this.profileRepo.save({
      userId: user.id,
      firstName: input.firstName || '',
      lastName: input.lastName || '',
      companyName: input.companyName,
      phoneNumber: input.phoneNumber
    });
  }

  @OnEvent(NestAuthEvents.USER_DELETED)
  async handleUserDeleted(payload: any) {
    // Clean up profile when user is deleted
    await this.profileRepo.delete({ userId: payload.user.id });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    await this.profileRepo.update({ userId }, data);
    return this.getProfile(userId);
  }
}
\`\`\`

---

### Email Notification Service

\`\`\`typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NestAuthEvents } from '@ackplus/nest-auth';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailNotificationService {
  constructor(private mailerService: MailerService) {}

  @OnEvent(NestAuthEvents.REGISTERED)
  async sendWelcomeEmail(payload: any) {
    const { user, input } = payload;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Welcome to Our Platform!',
      template: 'welcome',
      context: {
        name: input.firstName || user.email,
        email: user.email
      }
    });
  }

  @OnEvent(NestAuthEvents.EMAIL_VERIFICATION_REQUESTED)
  async sendVerificationEmail(payload: any) {
    const { user, otp } = payload;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Verify Your Email',
      template: 'verification',
      context: {
        code: otp.code,
        expiresAt: otp.expiresAt
      }
    });
  }

  @OnEvent(NestAuthEvents.TWO_FACTOR_CODE_SENT)
  async send2FACode(payload: any) {
    const { user, method, code } = payload;

    if (method === 'email') {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Your 2FA Code',
        template: '2fa-code',
        context: {
          code: code,
          validFor: '5 minutes'
        }
      });
    }
  }

  @OnEvent(NestAuthEvents.PASSWORD_RESET_REQUESTED)
  async sendPasswordResetEmail(payload: any) {
    const { user, otp } = payload;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      context: {
        code: otp.code,
        expiresAt: otp.expiresAt
      }
    });
  }

  @OnEvent(NestAuthEvents.PASSWORD_RESET)
  async sendPasswordResetConfirmation(payload: any) {
    const { user } = payload;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Password Reset Successful',
      template: 'password-reset-success',
      context: {
        timestamp: new Date().toISOString()
      }
    });
  }
}
\`\`\`

---

### Protected Route with Roles

\`\`\`typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NestAuthAuthGuard, Roles, CurrentUser } from '@ackplus/nest-auth';
import { NestAuthUser } from '@ackplus/nest-auth';

@Controller('admin')
@UseGuards(NestAuthAuthGuard)
export class AdminController {

  @Get('users')
  @Roles('admin', 'super-admin')
  async getUsers() {
    // Only accessible by admin or super-admin
    return { users: [] };
  }

  @Post('users/:id/suspend')
  @Roles('super-admin')
  async suspendUser(@Param('id') userId: string) {
    // Only super-admins can suspend users
    return { message: 'User suspended' };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: NestAuthUser) {
    // Any authenticated user can access
    return { user };
  }
}
\`\`\`

---

## Complete Flows

### Complete MFA Setup Flow

\`\`\`typescript
// 1. User logs in
const loginResponse = await api.post('/auth/login', {
  providerName: 'email',
  credentials: {
    email: 'user@example.com',
    password: 'SecurePass123!'
  }
});

const { accessToken } = loginResponse.data;
localStorage.setItem('accessToken', accessToken);

// 2. Check MFA status
const mfaStatus = await api.get('/auth/mfa/status');
console.log(mfaStatus.data);
// { isEnabled: false, enabledMethods: [], availableMethods: ['totp', 'email', 'sms'] }

// 3. Setup TOTP (Authenticator App)
const setupResponse = await api.post('/auth/mfa/setup-totp');
const { secret, qrCode } = setupResponse.data;

// Display QR code to user
// <img src={qrCode} alt="Scan with authenticator app" />

// 4. User scans QR code and enters code from app
const userEnteredCode = '123456'; // From Google Authenticator

await api.post('/auth/mfa/verify-totp-setup', {
  secret: secret,
  otp: userEnteredCode
});

// 5. Enable MFA for user
await api.post('/auth/mfa/toggle', {
  enabled: true
});

// 6. Generate recovery code (important!)
const recoveryResponse = await api.post('/auth/mfa/generate-recovery-code');
const { code } = recoveryResponse.data;
// Display recovery code to user and ask them to save it securely
alert(\`Save this recovery code: \${code}\`);
\`\`\`

---

### Complete Password Reset Flow

\`\`\`typescript
// 1. User requests password reset
await api.post('/auth/forgot-password', {
  email: 'user@example.com'
});
// User receives OTP via email

// 2. User enters OTP from email
const otpResponse = await api.post('/auth/verify-forgot-password-otp', {
  email: 'user@example.com',
  otp: '123456'
});

const { resetToken } = otpResponse.data;

// 3. User sets new password with reset token
await api.post('/auth/reset-password-with-token', {
  token: resetToken,
  newPassword: 'NewSecurePass789!'
});

// Password reset complete, redirect to login
window.location.href = '/login';
\`\`\`

---

### SSO Integration (Google)

**Backend Configuration**:
\`\`\`typescript
NestAuthModule.forRoot({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/auth/callback/google'
  }
})
\`\`\`

**Frontend Flow**:
\`\`\`typescript
// 1. User clicks "Sign in with Google"
// Redirect to Google OAuth
window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' +
  \`client_id=\${GOOGLE_CLIENT_ID}\` +
  \`&redirect_uri=http://localhost:3000/auth/callback/google\` +
  \`&response_type=code\` +
  \`&scope=openid email profile\`;

// 2. After Google redirects back, extract authorization code from URL
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

// 3. Exchange code for Google access token (client-side SDK)
const googleResponse = await gapi.auth2.getAuthInstance().signIn();
const googleAccessToken = googleResponse.getAuthResponse().access_token;

// 4. Login to your backend with Google token
const { data } = await api.post('/auth/login', {
  providerName: 'google',
  credentials: {
    token: googleAccessToken,
    type: 'access' // or 'id' for ID Tokens
  },
  createUserIfNotExists: true // Auto-create user
});

// 5. Store tokens and redirect
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
window.location.href = '/dashboard';
\`\`\`

---

## Mobile App Examples

### React Native Login (Header Mode)

\`\`\`typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.myapp.com',
});

// Add access token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  const trustToken = await AsyncStorage.getItem('trustToken');

  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  if (trustToken) {
    config.headers['x-nest-auth-trust-token'] = trustToken;
  }

  return config;
});

// Login function
async function login(email, password) {
  try {
    const { data } = await api.post('/auth/login', {
      providerName: 'email',
      credentials: { email, password }
    });

    if (data.isRequiresMfa) {
      // Navigate to 2FA screen with partial token
      return { needs2FA: true, partialToken: data.accessToken };
    }

    // Save tokens
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);

    return { needs2FA: false };
  } catch (error) {
    throw error;
  }
}

// Verify 2FA function
async function verify2FA(partialToken, otp, rememberDevice = true) {
  try {
    const { data } = await api.post('/auth/verify-2fa',
      {
        method: 'email',
        otp: otp,
        rememberDevice: rememberDevice
      },
      {
        headers: { Authorization: \`Bearer \${partialToken}\` }
      }
    );

    // Save tokens
    await AsyncStorage.setItem('accessToken', data.accessToken);
    await AsyncStorage.setItem('refreshToken', data.refreshToken);

    // IMPORTANT: Save trust token for "Remember Me"
    if (data.trustToken) {
      await AsyncStorage.setItem('trustToken', data.trustToken);
    }

    return true;
  } catch (error) {
    throw error;
  }
}

// Logout function
async function logout() {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Continue even if request fails
  } finally {
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'trustToken'
    ]);
  }
}
\`\`\`

---

### Flutter Example (Dart)

\`\`\`dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class AuthService {
  static const String baseUrl = 'https://api.myapp.com/auth';

  Future<Map<String, dynamic>> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();
    final trustToken = prefs.getString('trustToken');

    final response = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: {
        'Content-Type': 'application/json',
        if (trustToken != null) 'x-nest-auth-trust-token': trustToken,
      },
      body: jsonEncode({
        'providerName': 'email',
        'credentials': {
          'email': email,
          'password': password,
        }
      }),
    );

    final data = jsonDecode(response.body);

    if (data['isRequiresMfa'] == true) {
      return {'needs2FA': true, 'partialToken': data['accessToken']};
    }

    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);

    return {'needs2FA': false};
  }

  Future<bool> verify2FA(String partialToken, String otp) async {
    final prefs = await SharedPreferences.getInstance();

    final response = await http.post(
      Uri.parse('$baseUrl/verify-2fa'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $partialToken',
      },
      body: jsonEncode({
        'method': 'email',
        'otp': otp,
        'rememberDevice': true,
      }),
    );

    final data = jsonDecode(response.body);

    await prefs.setString('accessToken', data['accessToken']);
    await prefs.setString('refreshToken', data['refreshToken']);

    if (data['trustToken'] != null) {
      await prefs.setString('trustToken', data['trustToken']);
    }

    return true;
  }
}
\`\`\`

---

## Multi-Tenant Examples

### Tenant-Specific Login

\`\`\`typescript
// User logs in with tenant identifier
const { data } = await api.post('/auth/login', {
  providerName: 'email',
  credentials: {
    email: 'user@example.com',
    password: 'SecurePass123!'
  },
  tenantId: 'acme-corp' // Specify tenant
});

// Or use tenant from subdomain
const subdomain = window.location.hostname.split('.')[0];
const { data } = await api.post('/auth/login', {
  // ... credentials
  tenantId: subdomain
});
\`\`\`

### Backend: Create Users in Specific Tenant

\`\`\`typescript
import { Injectable } from '@nestjs/common';
import { UserService, TenantService } from '@ackplus/nest-auth';

@Injectable()
export class OrganizationService {
  constructor(
    private userService: UserService,
    private tenantService: TenantService
  ) {}

  async createOrganization(data: {
    orgName: string;
    orgSlug: string;
    adminEmail: string;
    adminPassword: string;
  }) {
    // 1. Create tenant
    const tenant = await this.tenantService.createTenant({
      name: data.orgName,
      slug: data.orgSlug,
      isActive: true
    });

    // 2. Create admin user in this tenant
    const admin = await this.userService.createUser({
      email: data.adminEmail,
      tenantId: tenant.id,
      isVerified: true
    });

    await admin.setPassword(data.adminPassword);
    await this.userService.updateUser(admin.id, admin);

    // 3. Assign admin role
    // (Assuming you have role management)

    return { tenant, admin };
  }
}
\`\`\`
`;
