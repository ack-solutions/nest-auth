import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import ms from 'ms';
import { AdminConsoleConfigService } from './admin-console-config.service';
import { NestAuthAdminUser } from '../entities/admin-user.entity';

interface AdminSessionPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class AdminSessionService {
  constructor(private readonly config: AdminConsoleConfigService) { }

  createSession(admin: NestAuthAdminUser): string {
    const secret = this.config.getSessionSecret();
    const duration = this.config.getSessionDuration();
    const expiresIn = typeof duration === 'number' ? duration : duration || '2h';
    return jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
      },
      secret,
      {
        expiresIn,
      },
    );
  }

  verifySession(token: string): AdminSessionPayload | null {
    if (!token) {
      return null;
    }
    try {
      return jwt.verify(token, this.config.getSessionSecret()) as AdminSessionPayload;
    } catch (error) {
      // Log JWT verification failures for security monitoring
      console.warn('JWT verification failed:', error.message);
      return null;
    }
  }

  getCookieName(): string {
    return this.config.getCookieName();
  }

  getMaxAge(): number | undefined {
    const duration = this.config.getSessionDuration();
    if (typeof duration === 'number') {
      return duration * 1000;
    }
    if (typeof duration === 'string') {
      return ms(duration);
    }
    return ms('2h');
  }

  extractToken(request: Request): string | undefined {
    const cookieName = this.getCookieName();
    const cookieHeader = request.headers?.cookie;

    if (request.cookies && request.cookies[cookieName]) {
      return request.cookies[cookieName];
    }

    if (!cookieHeader) {
      return undefined;
    }

    const cookies = this.parseCookieHeader(cookieHeader);
    return cookies[cookieName];
  }

  /**
   * Invalidate all sessions for a given admin user.
   * Since we're using stateless JWT tokens, this is a no-op for now,
   * but provides a hook for future stateful session implementations.
   */
  async invalidateSessionForAdmin(adminId: string): Promise<void> {
    // With JWT-based stateless sessions, we can't revoke tokens server-side
    // This method exists for future implementations that use database-backed sessions
    // For now, clearing the client cookie in the logout handler is sufficient
    return Promise.resolve();
  }

  private parseCookieHeader(header: string): Record<string, string> {
    return header.split(';').reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key) {
        return acc;
      }
      try {
        acc[key.trim()] = decodeURIComponent(rest.join('=').trim());
      } catch (error) {
        // If decoding fails, use the raw value
        acc[key.trim()] = rest.join('=').trim();
      }
      return acc;
    }, {});
  }
}
