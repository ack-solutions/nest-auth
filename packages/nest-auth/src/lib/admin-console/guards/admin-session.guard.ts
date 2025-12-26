import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminSessionService } from '../services/admin-session.service';
import { AdminUserService } from '../services/admin-user.service';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';
import { NestAuthAdminUser } from '../entities/admin-user.entity';

export interface AdminRequest extends Request {
  adminUser?: NestAuthAdminUser;
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly sessions: AdminSessionService,
    private readonly adminUsers: AdminUserService,
    private readonly config: AdminConsoleConfigService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    this.config.ensureEnabled();

    const token = this.sessions.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Admin authentication required');
    }

    const payload = this.sessions.verifySession(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid admin session');
    }

    const admin = await this.adminUsers.findById(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin account not found');
    }

    req.adminUser = admin;
    return true;
  }
}
