import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, IsNull, Not, Repository } from 'typeorm';
import { NestAuthUser } from '../entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EMAIL_AUTH_PROVIDER, NestAuthEvents, PHONE_AUTH_PROVIDER } from '../../auth.constants';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { UserCreatedEvent } from '../events/user-created.event';
import { TenantService } from '../../tenant';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { AuthConfigService } from '../../core/services/auth-config.service';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(NestAuthUser)
        private readonly userRepository: Repository<NestAuthUser>,
        private readonly tenantService: TenantService,
        private readonly eventEmitter: EventEmitter2,
        private readonly authConfigService: AuthConfigService,
        private readonly debugLogger: DebugLoggerService
    ) { }

    async createUser(data: Partial<NestAuthUser>, context?: any): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('createUser', 'UserService', { email: data.email, phone: data.phone, hasPassword: !!(data as any).password });

        try {
            const { email, phone } = data;
            let { tenantId = null } = data;

            // Resolve tenant ID
            tenantId = await this.tenantService.resolveTenantId(tenantId);
            data.tenantId = tenantId;

            // Check if user already exists
            if (email) {
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
            const user = this.userRepository.create(data);

            // Handle password if provided in data (even though it's not a column)
            if ((data as any).password) {
                await user.setPassword((data as any).password);
            }

            await this.userRepository.save(user);
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
                    tenantId: user.tenantId
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

        tenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!email) {
            this.debugLogger.warn('No email provided for user lookup', 'UserService');
            return null;
        }

        // Normalize email to lowercase for case-insensitive matching
        const normalizedEmail = email.toLowerCase().trim();

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            where: {
                email: normalizedEmail,
                tenantId: tenantId || IsNull()
            }
        });

        if (user) {
            this.debugLogger.debug('User found by email', 'UserService', { userId: user.id, tenantId });
        } else {
            this.debugLogger.debug('No user found with email', 'UserService', { tenantId });
        }

        return user;
    }

    async getUserByPhone(phone: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by phone', 'UserService', { phone: !!phone, tenantId });

        tenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!phone) {
            this.debugLogger.warn('No phone provided for user lookup', 'UserService');
            return null;
        }

        const user = await this.userRepository.findOne({
            ...(options ? options : {}),
            where: {
                phone,
                tenantId: tenantId || IsNull()
            }
        });

        if (user) {
            this.debugLogger.debug('User found by phone', 'UserService', { userId: user.id, tenantId });
        } else {
            this.debugLogger.debug('No user found with phone', 'UserService', { tenantId });
        }

        return user;
    }

    async getUsers(options?: FindManyOptions<NestAuthUser>): Promise<NestAuthUser[]> {
        return this.userRepository.find(options);
    }

    async getUsersByTenant(tenantId: string, options?: FindManyOptions<NestAuthUser>): Promise<NestAuthUser[]> {
        tenantId = await this.tenantService.resolveTenantId(tenantId || null);
        if (!tenantId) {
            return [];
        }

        return this.userRepository.find({
            ...(options ? options : {}),
            where: {
                tenantId,
                ...(options?.where ? options.where : {})
            }
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

            // If email or phone is being changed, check for conflicts
            if (data.email || data.phone) {
                this.debugLogger.debug('Checking for conflicts during user update', 'UserService', { userId: id, email: !!data.email, phone: !!data.phone });

                let existingUser = null;

                if (data.phone) {
                    existingUser = await this.userRepository.findOne({
                        where: { phone: data.phone, tenantId: user.tenantId, id: Not(user.id) }
                    });
                }

                if (!existingUser && data.email) {
                    existingUser = await this.userRepository.findOne({
                        where: { email: data.email, tenantId: user.tenantId, id: Not(user.id) }
                    });
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
                    tenantId: updatedUser.tenantId,
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
                    tenantId: user.tenantId
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
                tenantId: updatedUser.tenantId,
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
                tenantId: updatedUser.tenantId,
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
