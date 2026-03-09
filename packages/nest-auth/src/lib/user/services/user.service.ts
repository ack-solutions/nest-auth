import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, Not, Repository } from 'typeorm';
import { In } from 'typeorm';
import { NestAuthUser } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EMAIL_AUTH_PROVIDER, NestAuthEvents, PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserCreatedEvent } from '../events/user-created.event';
import { TenantService } from '../../tenant';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthTenantUser } from '../../tenant/entities/tenant-user.entity';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthTenantUser)
        private readonly tenantUserRepository: Repository<NestAuthTenantUser>,
        private readonly tenantService: TenantService,
        private readonly eventEmitter: EventEmitter2,
        private readonly authConfigService: AuthConfigService,
        private readonly debugLogger: DebugLoggerService
    ) { }

    async createUser(data: Partial<NestAuthUser>, tenantId?: string, context?: any): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('createUser', 'UserService', { email: data.email, phone: data.phone, hasPassword: !!(data as any).password });

        try {
            const { email, phone } = data;

            // Resolve tenant ID for duplicate check and membership; do not set user.tenantId (use tenantMemberships only)
            tenantId = await this.tenantService.resolveTenantId(tenantId);

            // Check if user already exists (by email in same tenant context)
            if (email) {
                // Normalize email before checking for duplicates

                const existingUser = await this.getUserByEmail(email, tenantId);
                if (existingUser) {
                    this.debugLogger.warn('User with email already exists', 'UserService', { email, tenantId });
                    throw new ConflictException({
                        message: 'User with this email already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            if (phone) {
                const existingUser = await this.getUserByPhone(phone, tenantId);
                if (existingUser) {
                    this.debugLogger.warn('User with phone already exists', 'UserService', { phone, tenantId });
                    throw new ConflictException({
                        message: 'User with this phone number already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            // Apply user.beforeCreate hook if configured
            const config = this.authConfigService.getConfig();
            if (config.user?.beforeCreate) {
                this.debugLogger.debug('Applying user.beforeCreate hook', 'UserService');
                data = await config.user.beforeCreate(data, context);
            }

            this.debugLogger.debug('Creating new user entity', 'UserService');
            delete (data as any).tenantId;
            const user = this.userRepository.create(data);

            // Handle password if provided in data (even though it's not a column)
            if ((data as any).password) {
                await user.setPassword((data as any).password);
            }

            await this.userRepository.save(user);

            if (tenantId) {
                await this.ensureTenantMembership(user.id, tenantId);
            }
            this.debugLogger.info('User created successfully', 'UserService', { userId: user.id });

            // Create identities
            const normalizedEmail = email?.toLowerCase().trim();
            if (normalizedEmail && config.emailAuth?.enabled !== false) {
                await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, normalizedEmail);
            }
            if (phone && config.phoneAuth?.enabled === true) {
                await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, phone);
            }

            // Emit user created event
            this.debugLogger.debug('Emitting user created event', 'UserService', { userId: user.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_CREATED,
                new UserCreatedEvent({
                    user,
                    input: context,
                    tenantId: tenantId ?? (await this.getFirstTenantIdForUser(user.id)) ?? undefined
                })
            );

            // Apply user.afterCreate hook if configured
            if (config.user?.afterCreate) {
                this.debugLogger.debug('Applying user.afterCreate hook', 'UserService', { userId: user.id });
                await config.user.afterCreate(user, context);
            }

            this.debugLogger.logFunctionExit('createUser', 'UserService', { userId: user.id });
            return user;

        } catch (error) {
            this.debugLogger.logError(error, 'createUser', { email: data.email, phone: data.phone });
            throw error;
        }
    }

    async getUserById(id: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by ID', 'UserService', { userId: id });

        if (!id) {
            this.debugLogger.warn('No user ID provided', 'UserService');
            return null;
        }

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            where: { id }
        });

        if (!user) {
            this.debugLogger.warn('User not found', 'UserService', { userId: id });
            return null;
        }

        this.debugLogger.debug('User found', 'UserService', { userId: user.id });
        return user;
    }

    async getUserByEmail(email: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by email', 'UserService', { email: !!email, tenantId });

        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!email) {
            this.debugLogger.warn('No email provided for user lookup', 'UserService');
            return null;
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (resolvedTenantId) {
            // Find user by email who has a membership in this tenant
            const user = await this.userRepository
                .createQueryBuilder('u')
                .innerJoin('u.tenantMemberships', 'm', 'm.tenantId = :tid AND m.isActive = :active', {
                    tid: resolvedTenantId,
                    active: true,
                })
                .where('u.email = :email', { email: normalizedEmail, tid: resolvedTenantId, active: true })
                .getOne();
            if (user) {
                this.debugLogger.debug('User found by email', 'UserService', { userId: user.id, tenantId: resolvedTenantId });
            } else {
                this.debugLogger.debug('No user found with email in tenant', 'UserService', { tenantId: resolvedTenantId });
            }
            return user;
        }

        // No tenant context: find by email (any user)
        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            where: { email: normalizedEmail },
        });
        if (user) {
            this.debugLogger.debug('User found by email', 'UserService', { userId: user.id });
        } else {
            this.debugLogger.debug('No user found with email', 'UserService');
        }
        return user;
    }

    async getUserByPhone(phone: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by phone', 'UserService', { phone: !!phone, tenantId });

        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!phone) {
            this.debugLogger.warn('No phone provided for user lookup', 'UserService');
            return null;
        }

        if (resolvedTenantId) {
            const user = await this.userRepository
                .createQueryBuilder('u')
                .innerJoin('u.tenantMemberships', 'm', 'm.tenantId = :tid AND m.isActive = :active', {
                    tid: resolvedTenantId,
                    active: true,
                })
                .where('u.phone = :phone', { phone, tid: resolvedTenantId, active: true })
                .getOne();
            if (user) {
                this.debugLogger.debug('User found by phone', 'UserService', { userId: user.id, tenantId: resolvedTenantId });
            } else {
                this.debugLogger.debug('No user found with phone in tenant', 'UserService', { tenantId: resolvedTenantId });
            }
            return user;
        }

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            where: { phone },
        });
        if (user) {
            this.debugLogger.debug('User found by phone', 'UserService', { userId: user.id });
        } else {
            this.debugLogger.debug('No user found with phone', 'UserService');
        }
        return user;
    }

    async getUsers(options?: FindManyOptions<NestAuthUser>): Promise<NestAuthUser[]> {
        return this.userRepository.find(options);
    }

    async getUsersByTenant(tenantId: string, options?: FindManyOptions<NestAuthUser>): Promise<NestAuthUser[]> {
        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!resolvedTenantId) {
            return [];
        }

        const relations = Array.isArray(options?.relations)
            ? Array.from(new Set([...(options?.relations || []), 'tenantMemberships']))
            : options?.relations;
        return this.userRepository.find({
            ...(options ? options : {}),
            relations,
            where: {
                tenantMemberships: { tenantId: resolvedTenantId, isActive: true },
                ...(options?.where ? options.where : {}),
            },
        });
    }

    async updateUser(id: string, data: Partial<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('updateUser', 'UserService', { userId: id, fields: Object.keys(data) });

        try {
            const user = await this.getUserById(id);

            if (!user) {
                this.debugLogger.error('User not found for update', 'UserService', { userId: id });
                throw new NotFoundException({
                    message: `User with ID ${id} not found`,
                    code: 'USER_NOT_FOUND'
                });
            }

            // If email or phone is being changed, check for conflicts (same tenant context via memberships)
            if (data.email || data.phone) {
                this.debugLogger.debug('Checking for conflicts during user update', 'UserService', { userId: id, email: !!data.email, phone: !!data.phone });

                const userWithMemberships = await this.getUserById(id, {
                    relations: ['tenantMemberships'],
                });
                const tenantIds = (userWithMemberships?.tenantMemberships ?? [])
                    .filter((m) => m.isActive)
                    .map((m) => m.tenantId) ?? [];

                let existingUser: NestAuthUser | null = null;

                if (data.phone) {
                    if (tenantIds.length) {
                        existingUser = await this.userRepository
                            .createQueryBuilder('u')
                            .innerJoin('u.tenantMemberships', 'm', 'm.isActive = :active', { active: true })
                            .where('m.tenantId IN (:...tenantIds)', { tenantIds })
                            .andWhere('u.phone = :phone', { phone: data.phone })
                            .andWhere('u.id != :id', { id })
                            .getOne();
                    } else {
                        existingUser = await this.userRepository.findOne({
                            where: { phone: data.phone, id: Not(id) },
                        });
                    }
                }

                if (!existingUser && data.email) {
                    const normalizedEmail = data.email.toLowerCase().trim();
                    if (tenantIds.length) {
                        existingUser = await this.userRepository
                            .createQueryBuilder('u')
                            .innerJoin('u.tenantMemberships', 'm', 'm.isActive = :active', { active: true })
                            .where('m.tenantId IN (:...tenantIds)', { tenantIds })
                            .andWhere('u.email = :email', { email: normalizedEmail })
                            .andWhere('u.id != :id', { id })
                            .getOne();
                    } else {
                        existingUser = await this.userRepository.findOne({
                            where: { email: normalizedEmail, id: Not(id) },
                        });
                    }
                }

                if (existingUser) {
                    this.debugLogger.warn('Conflict detected during user update', 'UserService', { userId: id, conflictingUserId: existingUser.id });
                    throw new ConflictException({
                        message: `User with ${data.email ? `email ${data.email}` : ''}${data.email && data.phone ? ' or ' : ''}${data.phone ? `phone ${data.phone}` : ''} already exists.`,
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            // Prevent changing tenant
            delete data.tenantId;

            this.debugLogger.debug('Updating user data', 'UserService', { userId: id, fields: Object.keys(data) });
            Object.assign(user, data);
            const updatedUser = await this.userRepository.save(user);
            this.debugLogger.info('User updated successfully', 'UserService', { userId: updatedUser.id });

            const config = this.authConfigService.getConfig();

            if (data.email && config.emailAuth?.enabled !== false) {
                this.debugLogger.debug('Updating email identity', 'UserService', { userId: id });
                await user.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: data.email });
            }

            if (data.phone && config.phoneAuth?.enabled === true) {
                this.debugLogger.debug('Updating phone identity', 'UserService', { userId: id });
                await user.updateOrCreateIdentity(PHONE_AUTH_PROVIDER, { providerId: data.phone });
            }

            // Emit user updated event
            this.debugLogger.debug('Emitting user updated event', 'UserService', { userId: updatedUser.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_UPDATED,
                new UserUpdatedEvent({
                    user: updatedUser,
                    tenantId: (await this.getFirstTenantIdForUser(updatedUser.id)) ?? undefined,
                    updatedFields: Object.keys(data)
                })
            );

            this.debugLogger.logFunctionExit('updateUser', 'UserService', { userId: updatedUser.id });
            return updatedUser;

        } catch (error) {
            this.debugLogger.logError(error, 'updateUser', { userId: id, fields: Object.keys(data) });
            throw error;
        }
    }

    async ensureTenantMembership(
        userId: string,
        tenantId: string,
    ): Promise<NestAuthTenantUser> {
        if (!userId || !tenantId) {
            return null;
        }

        const existing = await this.tenantUserRepository.findOne({
            where: { userId, tenantId }
        });

        if (existing) {
            return existing;
        }

        const membership = this.tenantUserRepository.create({
            userId,
            tenantId,
        });
        return await this.tenantUserRepository.save(membership);
    }

    async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
        if (!userId || !tenantId) {
            return false;
        }
        const membership = await this.tenantUserRepository.findOne({
            where: { userId, tenantId, isActive: true }
        });
        return !!membership;
    }

    /**
     * Set roles for a tenant membership by role IDs (per-tenant roles).
     */
    async setTenantUserRoles(
        userId: string,
        tenantId: string,
        roleIds: string[]
    ): Promise<NestAuthTenantUser> {
        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantId);
        if (!resolvedTenantId) {
            throw new BadRequestException('Invalid tenant');
        }
        let membership = await this.tenantUserRepository.findOne({
            where: { userId, tenantId: resolvedTenantId },
            relations: ['roles'],
        });
        if (!membership) {
            membership = await this.ensureTenantMembership(userId, resolvedTenantId);
        }
        if (!roleIds?.length) {
            membership.roles = [];
        } else {
            const roleEntities = await NestAuthRole.find({ where: { id: In(roleIds) } });
            membership.roles = roleEntities;
        }
        return this.tenantUserRepository.save(membership);
    }

    async getUserTenants(userId: string): Promise<NestAuthTenant[]> {
        if (!userId) {
            return [];
        }
        const memberships = await this.tenantUserRepository.find({
            where: { userId, isActive: true },
            relations: ['tenant']
        });
        return memberships
            .map(m => m.tenant)
            .filter(Boolean);
    }

    private getTenantMode(): TenantModeEnum {
        return this.authConfigService.getConfig().tenantMode || TenantModeEnum.ISOLATED;
    }

    /** Get first active tenant id for user (from tenantMemberships). */
    private async getFirstTenantIdForUser(userId: string): Promise<string | null> {
        const m = await this.tenantUserRepository.findOne({
            where: { userId, isActive: true },
        });
        return m?.tenantId ?? null;
    }

    async deleteUser(id: string): Promise<void> {
        this.debugLogger.logFunctionEntry('deleteUser', 'UserService', { userId: id });

        try {
            const user = await this.getUserById(id);

            if (!user) {
                this.debugLogger.error('User not found for deletion', 'UserService', { userId: id });
                throw new NotFoundException({
                    message: `User with ID ${id} not found`,
                    code: 'USER_NOT_FOUND'
                });
            }

            // Emit user deleted event before deletion
            this.debugLogger.debug('Emitting user deleted event', 'UserService', { userId: id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_DELETED,
                new UserDeletedEvent({
                    user,
                    tenantId: (await this.getFirstTenantIdForUser(user.id)) ?? undefined
                })
            );

            this.debugLogger.debug('Deleting user from database', 'UserService', { userId: id });
            await this.userRepository.remove(user);
            this.debugLogger.info('User deleted successfully', 'UserService', { userId: id });

            this.debugLogger.logFunctionExit('deleteUser', 'UserService', { userId: id });

        } catch (error) {
            this.debugLogger.logError(error, 'deleteUser', { userId: id });
            throw error;
        }
    }

    async verifyUser(id: string, verificationType?: 'email' | 'phone' | 'none'): Promise<NestAuthUser> {
        const user = await this.getUserById(id);

        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${id} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        if (verificationType === 'email') {
            user.emailVerifiedAt = new Date();
        } else if (verificationType === 'phone') {
            user.phoneVerifiedAt = new Date();
        }

        user.isVerified = true;

        return this.userRepository.save(user);
    }

    async unverifyUser(id: string, verificationType?: 'email' | 'phone' | 'none'): Promise<NestAuthUser> {
        const user = await this.getUserById(id);

        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${id} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        if (verificationType === 'email') {
            user.emailVerifiedAt = null;
        } else if (verificationType === 'phone') {
            user.phoneVerifiedAt = null;
        }

        user.isVerified = false;

        // Update isVerified flag based on remaining verification status
        user.isVerified = Boolean(user.emailVerifiedAt || user.phoneVerifiedAt);

        return this.userRepository.save(user);
    }

    async updateUserStatus(id: string, isActive: boolean): Promise<NestAuthUser> {
        const user = await this.getUserById(id);

        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${id} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        user.isActive = isActive;
        const updatedUser = await this.userRepository.save(user);

        // Emit user updated event
        this.debugLogger.debug('Emitting user updated event (status change)', 'UserService', { userId: id, isActive });
        await this.eventEmitter.emitAsync(
            NestAuthEvents.USER_UPDATED,
            new UserUpdatedEvent({
                user: updatedUser,
                updatedFields: ['isActive']
            })
        );

        return updatedUser;
    }

    async updateUserMetadata(id: string, metadata: Record<string, any>): Promise<NestAuthUser> {
        const user = await this.getUserById(id);

        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${id} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        user.metadata = {
            ...user.metadata,
            ...metadata
        };

        const updatedUser = await this.userRepository.save(user);

        // Emit user updated event
        this.debugLogger.debug('Emitting user updated event (metadata)', 'UserService', { userId: id });
        await this.eventEmitter.emitAsync(
            NestAuthEvents.USER_UPDATED,
            new UserUpdatedEvent({
                user: updatedUser,
                updatedFields: ['metadata']
            })
        );

        return updatedUser;
    }

    async countUsers(options?: FindManyOptions<NestAuthUser>): Promise<number> {
        return this.userRepository.count(options);
    }

    async getUsersAndCount(options?: FindManyOptions<NestAuthUser>): Promise<[NestAuthUser[], number]> {
        return this.userRepository.findAndCount(options);
    }

    async getUsersByRole(roleName: string, guard: string): Promise<NestAuthUser[]> {
        this.debugLogger.debug('Getting users by role', 'UserService', { roleName, guard });

        const users = await this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role')
            .where('role.name = :roleName', { roleName })
            .andWhere('role.guard = :guard', { guard })
            .getMany();

        this.debugLogger.debug('Found users with role', 'UserService', { roleName, count: users.length });
        return users;
    }
}
