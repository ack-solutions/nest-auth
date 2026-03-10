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
import { NestAuthTenantMembership } from '../../tenant/entities/tenant-membership.entity';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { IAuthModuleOptions } from '../../core/interfaces/auth-module-options.interface';
import { normalizedEmail, normalizedPhone } from '../../utils';

@Injectable()
export class UserService {
    private authConfig: IAuthModuleOptions;
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthTenantMembership)
        private readonly tenantMembershipRepository: Repository<NestAuthTenantMembership>,
        private readonly tenantService: TenantService,
        private readonly eventEmitter: EventEmitter2,
        private readonly authConfigService: AuthConfigService,
        private readonly debugLogger: DebugLoggerService
    ) {
        this.authConfig = this.authConfigService.getConfig();
    }

    async createUser(data: Partial<NestAuthUser>, tenantId?: string, context?: any): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('createUser', 'UserService', { email: data.email, phone: data.phone, hasPassword: !!(data as any).password });

        try {
            const email = normalizedEmail(data.email);
            const phone = normalizedPhone(data.phone);

            if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
                if (!tenantId) {
                    throw new BadRequestException('Tenant ID is required for isolated tenant mode');
                }
            }

            // Check if user already exists (by email in same tenant context)
            if (email) {
                let existingUser = null;
                if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
                    existingUser = await this.getUserByEmail(email, tenantId);
                } else {
                    existingUser = await this.getUserByEmail(email);
                }
                if (existingUser) {
                    this.debugLogger.warn('User with email already exists', 'UserService', { email, tenantId });
                    throw new ConflictException({
                        message: 'User with this email already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            if (phone) {
                let existingUser = null;
                if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
                    existingUser = await this.getUserByPhone(phone, tenantId);
                } else {
                    existingUser = await this.getUserByPhone(phone);
                }

                if (existingUser) {
                    this.debugLogger.warn('User with phone already exists', 'UserService', { phone, tenantId });
                    throw new ConflictException({
                        message: 'User with this phone number already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }


            if (this.authConfig.user?.beforeCreate) {
                this.debugLogger.debug('Applying user.beforeCreate hook', 'UserService');
                data = await this.authConfig.user.beforeCreate?.(data, context) ?? data;
            }

            this.debugLogger.debug('Creating new user entity', 'UserService');

            const user = this.userRepository.create({
                ...data,
                ...(email != null && { email: email }),
                ...(phone != null && { phone: phone }),
            });

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
            if (email && this.authConfig.emailAuth?.enabled !== false) {
                await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, email);
            }

            if (phone && this.authConfig.phoneAuth?.enabled === true) {
                await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, phone);
            }

            // Emit user created event
            this.debugLogger.debug('Emitting user created event', 'UserService', { userId: user.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_CREATED,
                new UserCreatedEvent({
                    user,
                    input: context,
                    tenantId: tenantId
                })
            );

            // Apply user.afterCreate hook if configured
            if (this.authConfig.user?.afterCreate) {
                this.debugLogger.debug('Applying user.afterCreate hook', 'UserService', { userId: user.id });
                await this.authConfig.user.afterCreate?.(user, context);
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

        const emailNorm = normalizedEmail(email);
        if (!emailNorm) {
            this.debugLogger.warn('No email provided for user lookup', 'UserService');
            return null;
        }

        if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
            if (!tenantId) {
                this.debugLogger.warn('No tenant ID provided for user lookup', 'UserService');
                throw new BadRequestException('Tenant ID is required for isolated tenant mode');
            }

            // Find user by email who has a membership in this tenant
            const user = await this.userRepository
                .createQueryBuilder('u')
                .innerJoin('u.tenantMemberships', 'm', 'm.tenantId = :tid AND m.isActive = :active', {
                    tid: tenantId,
                    active: true,
                })
                .where('u.email = :email', { email: emailNorm, tid: tenantId, active: true })
                .getOne();
            if (user) {
                this.debugLogger.debug('User found by email', 'UserService', { userId: user.id, tenantId: tenantId });
            } else {
                this.debugLogger.debug('No user found with email in tenant', 'UserService', { tenantId: tenantId });
            }
            return user;
        } else {
            const user = await this.userRepository.findOne({
                ...(options ? options : {}),
                relations: ['tenantMemberships', ...(Array.isArray(options?.relations) ? options.relations : [])],
                where: {
                    email: emailNorm,
                    ...(tenantId ? { tenantMemberships: { tenantId: tenantId } } : {}),
                },
            });
            if (user) {
                this.debugLogger.debug('User found by email', 'UserService', { userId: user.id });
            } else {
                this.debugLogger.debug('No user found with email', 'UserService');
            }
            return user;
        }
    }

    async getUserByPhone(phone: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by phone', 'UserService', { phone: !!phone, tenantId });

        const phoneNorm = normalizedPhone(phone);
        if (!phoneNorm) {
            this.debugLogger.warn('No phone provided for user lookup', 'UserService');
            return null;
        }

        if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
            if (!tenantId) {
                this.debugLogger.warn('No tenant ID provided for user lookup', 'UserService');
                throw new BadRequestException('Tenant ID is required for isolated tenant mode');
            }

            const user = await this.userRepository
                .createQueryBuilder('u')
                .innerJoin('u.tenantMemberships', 'm', 'm.tenantId = :tid AND m.isActive = :active', {
                    tid: tenantId,
                    active: true,
                })
                .where('u.phone = :phone', { phone: phoneNorm, tid: tenantId, active: true })
                .getOne();
            if (user) {
                this.debugLogger.debug('User found by phone', 'UserService', { userId: user.id, tenantId: tenantId });
            } else {
                this.debugLogger.debug('No user found with phone in tenant', 'UserService', { tenantId: tenantId });
            }
            return user;
        }

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            relations: ['tenantMemberships', ...(Array.isArray(options?.relations) ? options.relations : [])],
            where: {
                phone: phoneNorm,
                ...(tenantId ? { tenantMemberships: { tenantId: tenantId } } : {}),
            },
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
        const relations = Array.isArray(options?.relations)
            ? Array.from(new Set([...(options?.relations || []), 'tenantMemberships']))
            : options?.relations;

        return this.userRepository.find({
            ...(options ? options : {}),
            relations,
            where: {
                tenantMemberships: { tenantId: tenantId, isActive: true },
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

                let tenantId = null;
                if (this.authConfig.tenantMode === TenantModeEnum.ISOLATED) {
                    tenantId = userWithMemberships?.tenantMemberships[0]?.tenantId;
                }

                let existingUser: NestAuthUser | null = null;

                const phone = normalizedPhone(data.phone);
                const email = normalizedEmail(data.email);
                if (data.email != null) data.email = email;
                if (data.phone != null) data.phone = phone;

                if (phone != null) {
                    const userByPhone = await this.getUserByPhone(phone, tenantId, { select: ['id'] });
                    if (userByPhone && userByPhone.id !== id) {
                        existingUser = userByPhone;
                    }
                }

                if (!existingUser && email != null) {
                    const userByEmail = await this.getUserByEmail(email, tenantId, { select: ['id'] });
                    if (userByEmail && userByEmail.id !== id) {
                        existingUser = userByEmail;
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


            this.debugLogger.debug('Updating user data', 'UserService', { userId: id, fields: Object.keys(data) });
            Object.assign(user, data);
            const updatedUser = await this.userRepository.save(user);
            this.debugLogger.info('User updated successfully', 'UserService', { userId: updatedUser.id });

            if (data.email && this.authConfig.emailAuth?.enabled !== false) {
                this.debugLogger.debug('Updating email identity', 'UserService', { userId: id });
                await user.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: data.email });
            }

            if (data.phone && this.authConfig.phoneAuth?.enabled === true) {
                this.debugLogger.debug('Updating phone identity', 'UserService', { userId: id });
                await user.updateOrCreateIdentity(PHONE_AUTH_PROVIDER, { providerId: data.phone });
            }

            // Emit user updated event
            this.debugLogger.debug('Emitting user updated event', 'UserService', { userId: updatedUser.id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_UPDATED,
                new UserUpdatedEvent({
                    user: updatedUser,
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
    ): Promise<NestAuthTenantMembership> {
        if (!userId || !tenantId) {
            return null;
        }

        const existing = await this.tenantMembershipRepository.findOne({
            where: { userId, tenantId }
        });

        if (existing) {
            return existing;
        }

        const membership = this.tenantMembershipRepository.create({
            userId,
            tenantId,
        });
        return await this.tenantMembershipRepository.save(membership);
    }

    async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
        if (!userId || !tenantId) {
            return false;
        }
        const membership = await this.userRepository.createQueryBuilder('u')
            .innerJoin('u.tenantMemberships', 'm', 'm.tenantId = :tenantId', {
                tenantId,
            })
            .where('u.id = :userId', { userId })
            .select('m.id')
            .getRawOne();
        return !!membership;
    }

    /**
     * Set roles for a tenant membership by role IDs (per-tenant roles).
     */
    async setTenantMembershipRoles(
        userId: string,
        tenantId: string,
        roleIds: string[]
    ): Promise<NestAuthTenantMembership> {
        let membership = await this.tenantMembershipRepository.findOne({
            where: { userId, tenantId: tenantId },
            relations: ['roles'],
        });
        if (!membership) {
            membership = await this.ensureTenantMembership(userId, tenantId);
        }
        if (!roleIds?.length) {
            membership.roles = [];
        } else {
            const roleEntities = await NestAuthRole.find({ where: { id: In(roleIds) } });
            membership.roles = roleEntities;
        }
        return this.tenantMembershipRepository.save(membership);
    }

    async getUserTenants(userId: string): Promise<NestAuthTenant[]> {
        if (!userId) {
            return [];
        }
        const memberships = await this.tenantMembershipRepository.find({
            where: { userId, isActive: true },
            relations: ['tenant']
        });
        return memberships
            .map(m => m.tenant)
            .filter(Boolean);
    }

    /**
     * Remove a user's membership in a tenant. The user record is not deleted; only the
     * tenant membership is removed so the user no longer belongs to that tenant.
     */
    async deleteTenantMembership(userId: string, tenantId: string): Promise<void> {
        if (!userId || !tenantId) {
            return;
        }
        const membership = await this.tenantMembershipRepository.findOne({
            where: { userId, tenantId },
        });
        if (membership) {
            await this.tenantMembershipRepository.remove(membership);
            this.debugLogger.debug('Tenant membership deleted', 'UserService', { userId, tenantId });
        }
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

    async getUsersByRole(roleName: string, guard: string, tenantId?: string): Promise<NestAuthUser[]> {
        this.debugLogger.debug('Getting users by role', 'UserService', { roleName, guard });

        const usersQuery = this.userRepository
            .createQueryBuilder('user')
            .innerJoin('user.tenantMemberships', 'm')
            .innerJoin('m.roles', 'role', 'role.name = :roleName AND role.guard = :guard', {
                roleName,
                guard,
            })

        if (tenantId) {
            usersQuery.andWhere('m.tenantId = :tenantId', { tenantId });
        }

        const users = await usersQuery.getMany();

        this.debugLogger.debug('Found users with role', 'UserService', { roleName, count: users.length });
        return users;
    }
}
