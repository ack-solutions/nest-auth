import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindManyOptions, FindOneOptions, In, IsNull, Not, Repository } from 'typeorm';
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
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly tenantService: TenantService,
        private readonly eventEmitter: EventEmitter2,
        private readonly authConfigService: AuthConfigService,
        private readonly debugLogger: DebugLoggerService,
    ) { }

    /**
     * Run a function inside a TypeORM transaction and hand the caller the
     * transactional `EntityManager`. Pass that `manager` into any
     * transaction-aware nest-auth methods (`createUser`, `findOrCreateIdentity`,
     * `getUserAccess`, `assignRoles`, …) so a single rollback is possible
     * across the entire user-creation flow.
     *
     * If you don't need a transaction, just call the methods without the
     * `manager` argument — behaviour is unchanged.
     *
     * @example
     * ```ts
     * await this.userService.runInTransaction(async (manager) => {
     *   const authUser = await this.userService.createUser(
     *     { email, phone, isActive: true },
     *     undefined,
     *     undefined,
     *     manager,
     *   );
     *   if (password) await authUser.setPassword(password);
     *   await manager.save(authUser);
     *   await authUser.findOrCreateIdentity('email', email, manager);
     *   const access = await authUser.getUserAccess(tenantId, true, manager);
     *   await access.assignRoles(roleIds, manager);
     *
     *   // Application table — uses the same manager so the whole thing
     *   // rolls back together.
     *   const appUser = manager.create(AppUser, { authUserId: authUser.id, ... });
     *   await manager.save(appUser);
     *   return appUser;
     * });
     * ```
     */
    async runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.dataSource.transaction(fn);
    }

    /**
     * Pick the right repository — caller's transactional one when a
     * `manager` is supplied, otherwise the injected default. Keeps every
     * tx-aware method's logic readable.
     */
    private getUserRepo(manager?: EntityManager): Repository<NestAuthUser> {
        return manager ? manager.getRepository(NestAuthUser) : this.userRepository;
    }

    private getUserAccessRepo(manager?: EntityManager): Repository<NestAuthUserAccess> {
        return manager ? manager.getRepository(NestAuthUserAccess) : this.userAccessRepository;
    }

    /**
     * Create a `NestAuthUser` row plus its identities and a default
     * `userAccess` for the given tenant, atomically when a `manager` is
     * supplied.
     *
     * @param data       User column data (`email`, `phone`, `password` etc).
     * @param tenantId   Optional tenant scope.
     * @param context    Forwarded to `user.beforeCreate` / `afterCreate` hooks
     *                   and the `UserCreatedEvent` payload.
     * @param manager    Optional transactional `EntityManager` — pass the one
     *                   you got from {@link runInTransaction}. When omitted,
     *                   each statement uses the default datasource.
     */
    async createUser(data: Partial<NestAuthUser>, tenantId?: string, context?: any, manager?: EntityManager): Promise<NestAuthUser> {
        // When the caller supplies its own transactional manager, participate in
        // that transaction and let the caller emit USER_CREATED after it commits
        // (so the event reflects committed state and a later rollback can't leave
        // listeners acting on a phantom user).
        if (manager) {
            return this.createUserCore(data, tenantId, context, manager);
        }

        // Otherwise own the transaction so the whole create — user row + default
        // access + identities + the user.afterCreate hook — is atomic. A throw
        // anywhere (validation, conflict, or a failing afterCreate hook) rolls the
        // partial user back. USER_CREATED fires only after a successful commit.
        const created = await this.runInTransaction((m) => this.createUserCore(data, tenantId, context, m));

        await this.eventEmitter.emitAsync(
            NestAuthEvents.USER_CREATED,
            new UserCreatedEvent({
                user: created,
                input: context,
                tenantId,
            }),
        );

        return created;
    }

    /**
     * Inner create — performs every DB write through the supplied transactional
     * `manager` and runs the beforeCreate/afterCreate hooks, but does NOT emit
     * lifecycle events (the transactional boundary owner does that post-commit).
     */
    private async createUserCore(data: Partial<NestAuthUser>, tenantId: string | undefined, context: any, manager: EntityManager): Promise<NestAuthUser> {
        const config = this.authConfigService.getConfig();
        const userRepo = this.getUserRepo(manager);

        try {
            const email = normalizedEmail(data.email);
            const phone = normalizedPhone(data.phone);

            await this.tenantService.resolveTenantId(tenantId);

            // Check if user already exists (by email in same tenant context)
            if (email) {
                const existingUser = await this.getUserByEmail(email, tenantId, undefined, manager);
                if (existingUser) {
                    throw new ConflictException({
                        message: 'User with this email already exists',
                        code: 'USER_ALREADY_EXISTS'
                    });
                }
            }

            if (phone) {
                const existingUser = await this.getUserByPhone(phone, tenantId, undefined, manager);
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

            const user = userRepo.create({
                ...data,
                ...(email != null && { email: email }),
                ...(phone != null && { phone: phone }),
            });

            // Handle password if provided in data (even though it's not a column)
            if ((data as any).password) {
                await user.setPassword((data as any).password);
            }

            await userRepo.save(user);

            await this.ensureUserAccess(user.id, tenantId, manager);

            this.debugLogger.info('User created successfully', 'UserService', { userId: user.id });

            // Create identities
            if (email && config.emailAuth?.enabled !== false) {
                await user.findOrCreateIdentity(EMAIL_AUTH_PROVIDER, email, manager);
            }

            if (phone && config.phoneAuth?.enabled === true) {
                await user.findOrCreateIdentity(PHONE_AUTH_PROVIDER, phone, manager);
            }

            // Apply user.afterCreate hook if configured. It runs INSIDE the
            // transaction, so throwing here rolls the whole user back (no
            // partial create). USER_CREATED is emitted by the transaction owner
            // only after a successful commit.
            if (config.user?.afterCreate) {
                await config.user.afterCreate?.(user, context, manager);
            }

            this.debugLogger.logFunctionExit('createUser', 'UserService', { userId: user.id });
            return user;

        } catch (error) {
            this.debugLogger.logError(error, 'createUser', { email: data.email, phone: data.phone });
            throw error;
        }
    }

    async getUserById(id: string, options?: FindOneOptions<NestAuthUser>, manager?: EntityManager): Promise<NestAuthUser> {
        if (!id) {
            return null;
        }

        const user = await this.getUserRepo(manager).findOne({
            ...(options ? options : {}),
            where: { id }
        });

        if (!user) {
            this.debugLogger.warn('User not found', 'UserService', { userId: id });
            return null;
        }
        return user;
    }

    async getUserByEmail(email: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>, manager?: EntityManager): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by email', 'UserService', { email: !!email, tenantId });

        const emailNorm = normalizedEmail(email);
        if (!emailNorm) {
            this.debugLogger.warn('No email provided for user lookup', 'UserService');
            return null;
        }

        const tenantRequired = await this.tenantService.checkRequiredTenant(tenantId);

        const user = await this.getUserRepo(manager).findOne({
            ...(options ? options : {}),
            relations: ['userAccesses', ...(Array.isArray(options?.relations) ? options.relations : [])],
            where: {
                email: emailNorm,
                ...(tenantRequired ? { userAccesses: { tenantId: tenantId } } : {}),
            },
        });
        return user;
    }

    async getUserByPhone(phone: string, tenantId?: string, options?: FindOneOptions<NestAuthUser>, manager?: EntityManager): Promise<NestAuthUser> {
        this.debugLogger.debug('Getting user by phone', 'UserService', { phone: !!phone, tenantId });

        const phoneNorm = normalizedPhone(phone);
        if (!phoneNorm) {
            this.debugLogger.warn('No phone provided for user lookup', 'UserService');
            return null;
        }

        const tenantRequired = await this.tenantService.checkRequiredTenant(tenantId);

        const user = await this.getUserRepo(manager).findOne({
            ...(options ? options : {}),
            relations: ['userAccesses', ...(Array.isArray(options?.relations) ? options.relations : [])],
            where: {
                phone: phoneNorm,
                ...(tenantRequired ? { userAccesses: { tenantId: tenantId } } : {}),
            },
        });
        return user;
    }

    async getUsers(options?: FindManyOptions<NestAuthUser>, manager?: EntityManager): Promise<NestAuthUser[]> {
        return this.getUserRepo(manager).find(options);
    }

    /**
     * Update mutable fields on a `NestAuthUser` row. When `email`/`phone`
     * change, the matching identity is updated and a same-tenant uniqueness
     * check runs first.
     *
     * Pass `manager` to participate in a transaction — the conflict-check
     * SELECTs, the user UPDATE, and the identity UPSERTs all run on the
     * same connection so a rollback unwinds them together.
     */
    async updateUser(id: string, data: Partial<NestAuthUser>, manager?: EntityManager): Promise<NestAuthUser> {
        this.debugLogger.logFunctionEntry('updateUser', 'UserService', { userId: id, fields: Object.keys(data) });

        try {
            const user = await this.getUserById(id, undefined, manager);

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
                }, manager);

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
                    const userByPhone = await this.getUserByPhone(phone, tenantId, { select: ['id'] }, manager);
                    if (userByPhone && userByPhone.id !== id) {
                        existingUser = userByPhone;
                    }
                }

                if (!existingUser && email != null) {
                    const userByEmail = await this.getUserByEmail(email, tenantId, { select: ['id'] }, manager);
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
            const updateConfig = this.authConfigService.getConfig();

            // Persist the user row and its identities atomically — if an identity
            // write fails, the column change rolls back too (no half-applied update).
            const applyUpdate = async (m: EntityManager): Promise<NestAuthUser> => {
                // beforeUpdate hook — may mutate `data` or return a partial to merge,
                // or throw to abort. Runs inside the transaction.
                if (updateConfig.user?.beforeUpdate) {
                    const modified = await updateConfig.user.beforeUpdate(user, data, m);
                    if (modified) data = { ...data, ...modified };
                }

                Object.assign(user, data);
                const saved = await this.getUserRepo(m).save(user);

                if (data.email && updateConfig.emailAuth?.enabled !== false) {
                    this.debugLogger.debug('Updating email identity', 'UserService', { userId: id });
                    await user.updateOrCreateIdentity(EMAIL_AUTH_PROVIDER, { providerId: data.email }, m);
                }
                if (data.phone && updateConfig.phoneAuth?.enabled === true) {
                    this.debugLogger.debug('Updating phone identity', 'UserService', { userId: id });
                    await user.updateOrCreateIdentity(PHONE_AUTH_PROVIDER, { providerId: data.phone }, m);
                }

                // afterUpdate hook — inside the transaction, throwing rolls back.
                if (updateConfig.user?.afterUpdate) {
                    await updateConfig.user.afterUpdate(saved, data, m);
                }
                return saved;
            };

            const updatedUser = manager
                ? await applyUpdate(manager)
                : await this.runInTransaction(applyUpdate);

            // Emit AFTER the writes are persisted so listeners observe committed
            // state (when we own the transaction).
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
        manager?: EntityManager,
    ): Promise<NestAuthUserAccess> {
        if (!userId) {
            throw new BadRequestException({
                message: 'User ID is required',
                code: 'USER_ID_REQUIRED'
            });
        }
        const repo = this.getUserAccessRepo(manager);
        const existing = await repo.findOne({
            where: { userId, tenantId: tenantId || IsNull() }
        });

        if (existing) {
            return existing;
        }

        const access = repo.create({
            userId,
            ...tenantId ? { tenantId } : {},
        });
        return await repo.save(access);
    }

    async isUserInTenant(userId: string, tenantId: string, manager?: EntityManager): Promise<boolean> {
        if (!userId || !tenantId) {
            return false;
        }
        const access = await this.getUserRepo(manager).createQueryBuilder('u')
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
     * Pass `manager` to participate in a transaction.
     */
    async setUserAccessRoles(
        userId: string,
        tenantId: string,
        roleIds: string[],
        manager?: EntityManager,
    ): Promise<NestAuthUserAccess> {
        const accessRepo = this.getUserAccessRepo(manager);
        const roleRepo = manager ? manager.getRepository(NestAuthRole) : NestAuthRole.getRepository();

        let access = await accessRepo.findOne({
            where: { userId, tenantId: tenantId || IsNull() },
            relations: ['roles'],
        });
        if (!access) {
            access = await this.ensureUserAccess(userId, tenantId, manager);
        }
        if (!roleIds?.length) {
            access.roles = [];
        } else {
            const roleEntities = await roleRepo.find({ where: { id: In(roleIds) } });
            access.roles = roleEntities;
        }
        return accessRepo.save(access);
    }

    async getUserTenants(userId: string, manager?: EntityManager): Promise<NestAuthTenant[]> {
        if (!userId) {
            return [];
        }
        const accessList = await this.getUserAccessRepo(manager).find({
            where: { userId, isActive: true },
            relations: ['tenant']
        });
        return accessList
            .map(a => a.tenant)
            .filter(Boolean);
    }

    /**
     * Remove a user's access for a tenant.
     * Pass `manager` to participate in a transaction.
     */
    async deleteUserAccess(userId: string, tenantId: string, manager?: EntityManager): Promise<void> {
        if (!userId || !tenantId) {
            return;
        }
        const repo = this.getUserAccessRepo(manager);
        const access = await repo.findOne({
            where: { userId, tenantId },
        });
        if (access) {
            await repo.remove(access);
            this.debugLogger.debug('User access deleted', 'UserService', { userId, tenantId });
        }
    }

    /**
     * Delete a user. Pass `manager` to participate in a transaction.
     */
    async deleteUser(id: string, manager?: EntityManager): Promise<void> {
        this.debugLogger.logFunctionEntry('deleteUser', 'UserService', { userId: id });

        try {
            const user = await this.getUserById(id, undefined, manager);

            if (!user) {
                this.debugLogger.error('User not found for deletion', 'UserService', { userId: id });
                throw new NotFoundException({
                    message: `User with ID ${id} not found`,
                    code: 'USER_NOT_FOUND'
                });
            }

            const config = this.authConfigService.getConfig();

            // Snapshot the user for the post-commit event — TypeORM's remove()
            // clears the generated id from the live entity.
            const snapshot = Object.assign(
                Object.create(Object.getPrototypeOf(user)),
                user,
            ) as NestAuthUser;

            // Delete inside a transaction so the beforeDelete/afterDelete hooks
            // (and any related-row cleanup they perform via `manager`) commit or
            // roll back together with the removal. A throwing hook leaves the user
            // intact — no half-deleted state.
            const doDelete = async (m: EntityManager): Promise<void> => {
                if (config.user?.beforeDelete) {
                    await config.user.beforeDelete(user, m);
                }
                this.debugLogger.debug('Deleting user from database', 'UserService', { userId: id });
                await this.getUserRepo(m).remove(user);
                if (config.user?.afterDelete) {
                    await config.user.afterDelete(snapshot, m);
                }
            };

            if (manager) {
                await doDelete(manager);
            } else {
                await this.runInTransaction(doDelete);
            }

            this.debugLogger.info('User deleted successfully', 'UserService', { userId: id });

            // Emit AFTER the deletion commits, using the pre-delete snapshot so
            // listeners still have the user's data to act on.
            this.debugLogger.debug('Emitting user deleted event', 'UserService', { userId: id });
            await this.eventEmitter.emitAsync(
                NestAuthEvents.USER_DELETED,
                new UserDeletedEvent({
                    user: snapshot,
                })
            );

            this.debugLogger.logFunctionExit('deleteUser', 'UserService', { userId: id });

        } catch (error) {
            this.debugLogger.logError(error, 'deleteUser', { userId: id });
            throw error;
        }
    }

    async verifyUser(id: string, verificationType?: 'email' | 'phone' | 'none', manager?: EntityManager): Promise<NestAuthUser> {
        const user = await this.getUserById(id, undefined, manager);

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

        return this.getUserRepo(manager).save(user);
    }

    async unverifyUser(id: string, verificationType?: 'email' | 'phone' | 'none', manager?: EntityManager): Promise<NestAuthUser> {
        const user = await this.getUserById(id, undefined, manager);

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
        return this.getUserRepo(manager).save(user);
    }

    async updateUserStatus(id: string, isActive: boolean, manager?: EntityManager): Promise<NestAuthUser> {
        const user = await this.getUserById(id, undefined, manager);

        if (!user) {
            throw new NotFoundException({
                message: `User with ID ${id} not found`,
                code: 'USER_NOT_FOUND'
            });
        }

        user.isActive = isActive;
        const updatedUser = await this.getUserRepo(manager).save(user);

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

    async updateUserMetadata(id: string, metadata: Record<string, any>, manager?: EntityManager): Promise<NestAuthUser> {
        const user = await this.getUserById(id, undefined, manager);

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

        const updatedUser = await this.getUserRepo(manager).save(user);

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

    async countUsers(options?: FindManyOptions<NestAuthUser>, manager?: EntityManager): Promise<number> {
        return this.getUserRepo(manager).count(options);
    }

    async getUsersAndCount(options?: FindManyOptions<NestAuthUser>, manager?: EntityManager): Promise<[NestAuthUser[], number]> {
        return this.getUserRepo(manager).findAndCount(options);
    }

    async getUsersByRole(roleName: string, guard: string, tenantId?: string, manager?: EntityManager): Promise<NestAuthUser[]> {
        this.debugLogger.debug('Getting users by role', 'UserService', { roleName, guard });

        const usersQuery = this.getUserRepo(manager)
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
