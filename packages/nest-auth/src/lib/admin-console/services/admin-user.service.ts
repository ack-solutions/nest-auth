import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../entities/admin-user.entity';
import { DebugLoggerService } from '../../core/services/debug-logger.service';

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    private readonly debugLogger: DebugLoggerService,
  ) {}

  async createAdmin(data: {
    email: string;
    password: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<AdminUser> {
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

  async findByEmail(email: string): Promise<AdminUser | null> {
    if (!email) {
      return null;
    }
    return this.adminRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<AdminUser | null> {
    if (!id) {
      return null;
    }
    return this.adminRepo.findOne({ where: { id } });
  }

  async listAdmins(): Promise<AdminUser[]> {
    return this.adminRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateAdmin(
    id: string,
    data: { name?: string; password?: string; metadata?: Record<string, any> },
  ): Promise<AdminUser> {
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
    }

    await this.adminRepo.save(admin);
    return admin;
  }

  async deleteAdmin(id: string): Promise<void> {
    const admin = await this.findById(id);
    if (!admin) {
      throw new NotFoundException({
        message: `Admin user with ID ${id} not found`,
        code: 'ADMIN_USER_NOT_FOUND',
      });
    }
    await this.adminRepo.delete(id);
  }
}
