import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, In, IsNull, Not, Repository } from 'typeorm';
import { NestAuthUser } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EMAIL_AUTH_PROVIDER, ERROR_CODES, NestAuthEvents, PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserCreatedEvent } from '../events/user-created.event';
import { TenantService } from '../../tenant';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthUserAccess } from '../entities/user-access.entity';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';
import { NestAuthRole } from '../../role/entities/role.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { normalizedEmail, normalizedPhone } from '../../utils';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        @InjectRepository(NestAuthUserAccess)
        private readonly userAccessRepository: Repository<NestAuthUserAccess>,
        private readonly tenantService: TenantService,
        private readonly eventEmitter: EventEmitter2,
        private readonly authConfigService: AuthConfigService,
        private readonly debugLogger: DebugLoggerService,
    ) { }

    async createUser(data: Partial<NestAuthUser>, tenantId?: string, context?: any): Promise<NestAuthUser> {
        const config = this.authConfigService.getConfig();

        try {
            const email = normalizedEmail(data.email);
            const phone = normalizedPhone(data.phone);

            await this.tenantService.resolveTenantId(tenantId);

            // Check if user already exists (by email in same tenant context)
            if (email) {
                const existingUser = await this.getUserByEmail(email, tenantId);
                if (existingUser) {
                    throw new ConflictException({
                        message: 'User with this email already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            if (phone) {
                const existingUser = await this.getUserByPhone(phone, tenantId);
                if (existingUser) {
                    throw new ConflictException({
                        message: 'User with this phone number already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }


            if (config.user?.beforeCreate) {
                this.debugLogger.debug('Applying user.beforeCreate hook', 'UserService');
                data = await config.user.beforeCreate?.(data, context) ?? data;
            }

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

            await this.ensureUserAccess(user.id, tenantId);

            this.debugLogger.info('User created successfully', 'UserService', { userId: user.id });

            // Create identities
            if (email && config.emailAuth?.enabled !== false) {
                await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, email);
            }

            if (phone && config.phoneAuth?.enabled === true) {
                await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, phone);
            }

            // Emit user created event
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_CREATED,
                new UserCreatedEvent({
                    user,
                    input: context,
                    tenantId: tenantId
                })
            );

            // Apply user.afterCreate hook if configured
            if (config.user?.afterCreate) {
                await config.user.afterCreate?.(user, context);
            }

            this.debugLogger.logFunctionExit('createUser', 'UserService', { userId: user.id });
            return user;

        } catch (error) {
            this.debugLogger.logError(error, 'createUser', { email: data.email, phone: data.phone });
            throw error;
        }
    }

    async getUserById(id: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        if (!id) {
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
        return user;
    }

    async getUserByEmail(email: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by email', 'UserService', { email: !!email, tenantId });

        const emailNorm = normalizedEmail(email);
        if (!emailNorm) {
            this.debugLogger.warn('No email provided for user lookup', 'UserService');
            return null;
        }

        const tenantRequired = await this.tenantService.checkRequiredTenant(tenantId);

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            relations: ['userAccesses', ...(Array.isArray(options?.relations) ? options.relations : [])],
            where: {
                email: emailNorm,
                ...(tenantRequired ? { userAccesses: { tenantId: tenantId } } : {}),
            },
        });
        return user;
    }

    async getUserByPhone(phone: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by phone', 'UserService', { phone: !!phone, tenantId });

        const phoneNorm = normalizedPhone(phone);
        if (!phoneNorm) {
            this.debugLogger.warn('No phone provided for user lookup', 'UserService');
            return null;
        }

        const tenantRequired = await this.tenantService.checkRequiredTenant(tenantId);

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            relations: ['userAccesses', ...(Array.isArray(options?.relations) ? options.relations : [])],
            where: {
                phone: phoneNorm,
                ...(tenantRequired ? { userAccesses: { tenantId: tenantId } } : {}),
            },
        });
        return user;
    }

    async getUsers(options?: FindManyOptions<NestAuthUser>): Promise<NestAuthUser[]> {
        return this.userRepository.find(options);
    }

    async updateUser(id: string, data: Partial<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('updateUser', 'UserService', { userId: id, fields: Object.keys(data) });

        try {
            const user = await this.getUserById(id);

            if (!user) {
                throw new NotFoundException({
                    message: `User with ID ${id} not found`,
                    code: 'USER_NOT_FOUND'
                });
            }

            // If email or phone is being changed, check for conflicts (same tenant context via memberships)
            if (data.email || data.phone) {
                const config = this.authConfigService.getConfig();

                const userWithMemberships = await this.getUserById(id, {
                    relations: ['userAccesses'],
                });

                let tenantId = null;
                if (config.tenant?.mode === TenantModeEnum.ISOLATED) {
                    tenantId = userWithMemberships?.userAccesses?.[0]?.tenantId;
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
                    throw new ConflictException({
                        message: `User with ${data.email ? `email ${data.email}` : ''}${data.email && data.phone ? ' or ' : ''}${data.phone ? `phone ${data.phone}` : ''} already exists.`,
                        code: ERROR_CODES.USER_ALREADY_EXISTS,
                    });
                }
            }


            this.debugLogger.debug('Updating user data', 'UserService', { userId: id, fields: Object.keys(data) });
            Object.assign(user, data);
            const updatedUser = await this.userRepository.save(user);

            const updateConfig = this.authConfigService.getConfig();
            if (data.email && updateConfig.emailAuth?.enabled !== false) {
                this.debugLogger.debug('Updating email identity', 'UserService', { userId: id });
                await user.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: data.email });
            }

            if (data.phone && updateConfig.phoneAuth?.enabled === true) {
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
            throw error;
        }
    }

    async ensureUserAccess(
        userId: string,
        tenantId: string,
    ): Promise<NestAuthUserAccess> {
        if (!userId) {
            throw new BadRequestException({
                message: 'User ID is required',
                code: 'USER_ID_REQUIRED'
            });
        }
        const existing = await this.userAccessRepository.findOne({
            where: { userId, tenantId: tenantId || IsNull() }
        });

        if (existing) {
            return existing;
        }

        const access = this.userAccessRepository.create({
            userId,
            ...tenantId ? { tenantId } : {},
        });
        return await this.userAccessRepository.save(access);
    }

    async isUserInTenant(userId: string, tenantId: string): Promise<boolean> {
        if (!userId || !tenantId) {
            return false;
        }
        const access = await this.userRepository.createQueryBuilder('u')
            .innerJoin('u.userAccesses', 'm', 'm.tenantId = :tenantId', {
                tenantId,
            })
            .where('u.id = :userId', { userId })
            .select('m.id')
            .getRawOne();
        return !!access;
    }

    /**
     * Set multiple roles for a user's access in a tenant.
     */
    async setUserAccessRoles(
        userId: string,
        tenantId: string,
        roleIds: string[]
    ): Promise<NestAuthUserAccess> {
        let access = await this.userAccessRepository.findOne({
            where: { userId, tenantId: tenantId || IsNull() },
            relations: ['roles'],
        });
        if (!access) {
            access = await this.ensureUserAccess(userId, tenantId);
        }
        if (!roleIds?.length) {
            access.roles = [];
        } else {
            const roleEntities = await NestAuthRole.find({ where: { id: In(roleIds) } });
            access.roles = roleEntities;
        }
        return this.userAccessRepository.save(access);
    }

    async getUserTenants(userId: string): Promise<NestAuthTenant[]> {
        if (!userId) {
            return [];
        }
        const accessList = await this.userAccessRepository.find({
            where: { userId, isActive: true },
            relations: ['tenant']
        });
        return accessList
            .map(a => a.tenant)
            .filter(Boolean);
    }

    /**
     * Remove a user's access for a tenant.
     */
    async deleteUserAccess(userId: string, tenantId: string): Promise<void> {
        if (!userId || !tenantId) {
            return;
        }
        const access = await this.userAccessRepository.findOne({
            where: { userId, tenantId },
        });
        if (access) {
            await this.userAccessRepository.remove(access);
            this.debugLogger.debug('User access deleted', 'UserService', { userId, tenantId });
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
            .innerJoin('user.userAccesses', 'm')
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
