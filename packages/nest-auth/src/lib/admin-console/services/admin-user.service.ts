import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthAdminUser } from '../entities/admin-user.entity';
import { DebugLoggerService } from '../../core/services/debug-logger.service';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(NestAuthAdminUser)
    private readonly adminRepo: Repository<NestAuthAdminUser>,
    private readonly debugLogger: DebugLoggerService,
  ) { }

  async createAdmin(data: {
    email: string;
    password: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<NestAuthAdminUser> {
    const email = data.email.toLowerCase();
    const existing = await this.adminRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException({
        message: `Admin user with email ${email} already exists.`,
        code: 'ADMIN_USER_EXISTS',
      });
    }

    const admin = this.adminRepo.create({
      email,
      name: data.name,
      metadata: data.metadata ?? {},
    });
    await admin.setPassword(data.password);
    this.debugLogger.debug('Creating admin user', 'AdminUserService', { email });
    await this.adminRepo.save(admin);
    this.debugLogger.info('Admin user created', 'AdminUserService', { id: admin.id, email });
    return admin;
  }

  async findByEmail(email: string): Promise<NestAuthAdminUser | null> {
    if (!email) {
      return null;
    }
    return this.adminRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<NestAuthAdminUser | null> {
    if (!id) {
      return null;
    }
    return this.adminRepo.findOne({ where: { id } });
  }

  async listAdmins(): Promise<NestAuthAdminUser[]> {
    return this.adminRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateAdmin(
    id: string,
    data: { name?: string; password?: string; metadata?: Record<string, any> },
  ): Promise<NestAuthAdminUser> {
    const admin = await this.findById(id);
    if (!admin) {
      throw new NotFoundException({
        message: `Admin user with ID ${id} not found`,
        code: 'ADMIN_USER_NOT_FOUND',
      });
    }

    if (data.name !== undefined) {
      admin.name = data.name;
    }
    if (data.metadata !== undefined) {
      admin.metadata = data.metadata;
    }
    if (data.password) {
      await admin.setPassword(data.password);
      // A password change must invalidate the admin's outstanding session tokens
      // (bump tokenVersion) — otherwise a session that predates the reset stays
      // valid. Mirrors the secret-key reset-password flow.
      admin.tokenVersion = (admin.tokenVersion ?? 0) + 1;
    }

    await this.adminRepo.save(admin);
    return admin;
  }

  /** Revoke all of an admin's outstanding session tokens by bumping tokenVersion. */
  async revokeSessions(id: string): Promise<void> {
    await this.adminRepo.increment({ id }, 'tokenVersion', 1);
  }

  async deleteAdmin(id: string): Promise<void> {
    const admin = await this.findById(id);
    if (!admin) {
      throw new NotFoundException({
        message: `Admin user with ID ${id} not found`,
        code: 'ADMIN_USER_NOT_FOUND',
      });
    }
    // Refuse to delete the LAST admin — that would lock everyone out of the
    // console (the session-guarded management API needs a signed-in admin, and
    // the secret-key bootstrap is closed once an admin exists).
    const total = await this.adminRepo.count();
    if (total <= 1) {
      throw new ConflictException({
        message: 'Cannot delete the last remaining admin.',
        code: 'ADMIN_LAST_REMAINING',
      });
    }
    await this.adminRepo.delete(id);
  }
}
