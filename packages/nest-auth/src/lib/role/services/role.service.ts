import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, FindManyOptions, FindOneOptions, IsNull, Repository } from 'typeorm';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { DEFAULT_GUARD_NAME, GUARD_ERROR_CODES } from '../../auth.constants';
import { NestAuthPermission } from '../../permission/entities/permission.entity';
import { isUniqueConstraintViolation } from '../../utils';
import { NestAuthRole } from '../entities/role.entity';
import { NestAuthRolePermission } from '../entities/role-permission.entity';
import { getRolePermissionNames } from '../utils/role-mapper.util';

@Injectable()
export class RoleService {
    constructor(
        @InjectRepository(NestAuthRole)
        private roleRepository: Repository<NestAuthRole>,
        private dataSource: DataSource,
        private authConfigService: AuthConfigService,
    ) { }

    private getDefaultRoleGuard(): string {
        return this.authConfigService.getRoleGuards()[0] ?? DEFAULT_GUARD_NAME;
    }

    private getRoleRelations(includeTenant: boolean = true): string[] {
        const relations = ['rolePermissions', 'rolePermissions.permission'];
        if (includeTenant) {
            relations.push('tenant');
        }
        return relations;
    }

    private resolveAndValidateGuard(guard: string | null | undefined): string {
        const resolved = guard ?? this.getDefaultRoleGuard();
        if (!this.authConfigService.isRoleGuardAllowed(resolved)) {
            throw new BadRequestException({
                message: `Guard '${resolved}' is not allowed. Allowed guards: ${this.authConfigService.getRoleGuards().join(', ')}`,
                code: GUARD_ERROR_CODES.GUARD_NOT_ALLOWED,
            });
        }
        return resolved;
    }

    private normalizePermissionNames(permissionNames?: string | string[]): string[] {
        if (permissionNames === undefined || permissionNames === null) {
            return [];
        }

        const values = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
        const normalized: string[] = [];
        const seen = new Set<string>();

        for (const value of values) {
            const name = value?.trim();
            if (!name || seen.has(name)) {
                continue;
            }
            seen.add(name);
            normalized.push(name);
        }

        return normalized;
    }

    private buildRoleConflictMessage(name: string, guard: string, tenantId: string | null): string {
        const scope = tenantId ? `tenant '${tenantId}'` : 'global scope';
        return `Role with name '${name}' already exists in guard '${guard}' for ${scope}`;
    }

    private async ensureRoleIsUnique(
        manager: EntityManager,
        params: { id?: string; name: string; guard: string; tenantId: string | null },
    ): Promise<void> {
        const existingRole = await manager.getRepository(NestAuthRole).findOne({
            where: {
                name: params.name,
                guard: params.guard,
                tenantId: params.tenantId ?? IsNull(),
            },
        });

        if (existingRole && existingRole.id !== params.id) {
            throw new ConflictException({
                message: this.buildRoleConflictMessage(params.name, params.guard, params.tenantId),
                code: 'ROLE_ALREADY_EXISTS',
            });
        }
    }

    private async resolvePermissionsByNames(
        manager: EntityManager,
        permissionNames: string | string[] | undefined,
        roleGuard: string,
    ): Promise<NestAuthPermission[]> {
        const normalizedNames = this.normalizePermissionNames(permissionNames);
        if (!normalizedNames.length) {
            return [];
        }

        const permissionRepo = manager.getRepository(NestAuthPermission);
        const matchingPermissions = await permissionRepo
            .createQueryBuilder('permission')
            .where('permission.guard = :guard', { guard: roleGuard })
            .andWhere('permission.name IN (:...names)', { names: normalizedNames })
            .getMany();

        const matchingPermissionsByName = new Map(
            matchingPermissions.map((permission) => [permission.name, permission]),
        );
        const missingNames = normalizedNames.filter((name) => !matchingPermissionsByName.has(name));

        if (!missingNames.length) {
            return normalizedNames
                .map((name) => matchingPermissionsByName.get(name))
                .filter(Boolean);
        }

        const permissionsWithOtherGuards = await permissionRepo
            .createQueryBuilder('permission')
            .where('permission.name IN (:...names)', { names: missingNames })
            .getMany();

        const guardMismatchMap = new Map<string, Set<string>>();
        for (const permission of permissionsWithOtherGuards) {
            const guards = guardMismatchMap.get(permission.name) ?? new Set<string>();
            guards.add(permission.guard);
            guardMismatchMap.set(permission.name, guards);
        }

        const guardMismatchNames = missingNames.filter((name) => guardMismatchMap.has(name));
        const invalidNames = missingNames.filter((name) => !guardMismatchMap.has(name));
        const errors: string[] = [];

        if (guardMismatchNames.length) {
            const details = guardMismatchNames
                .map((name) => `${name} [${Array.from(guardMismatchMap.get(name) ?? []).sort().join(', ')}]`)
                .join(', ');
            errors.push(`Guard mismatch for permissions: ${details}. Expected guard '${roleGuard}'`);
        }

        if (invalidNames.length) {
            errors.push(`Unknown permissions: ${invalidNames.join(', ')}`);
        }

        throw new BadRequestException({
            message: errors.join('. '),
            code: 'ROLE_PERMISSION_VALIDATION_FAILED',
            invalidPermissions: invalidNames,
            guardMismatches: guardMismatchNames.map((name) => ({
                name,
                guards: Array.from(guardMismatchMap.get(name) ?? []).sort(),
            })),
        });
    }

    private async replaceRolePermissions(
        manager: EntityManager,
        roleId: string,
        permissions: NestAuthPermission[],
    ): Promise<void> {
        const rolePermissionRepo = manager.getRepository(NestAuthRolePermission);

        await rolePermissionRepo.delete({ roleId });

        if (!permissions.length) {
            return;
        }

        const rolePermissions = permissions.map((permission) =>
            rolePermissionRepo.create({
                roleId,
                permissionId: permission.id,
            }),
        );

        await rolePermissionRepo.save(rolePermissions);
    }

    private async getHydratedRole(
        manager: EntityManager,
        id: string,
        includeTenant: boolean = true,
    ): Promise<NestAuthRole | null> {
        return manager.getRepository(NestAuthRole).findOne({
            where: { id },
            relations: this.getRoleRelations(includeTenant),
        });
    }

    async createRole(
        name: string,
        guard: string | null | undefined,
        tenantId: string | null = null,
        isSystem: boolean = false,
        permissionNames?: string | string[],
        isActive: boolean = true,
    ): Promise<NestAuthRole> {
        const normalizedName = name?.trim();
        if (!normalizedName) {
            throw new BadRequestException({
                message: 'Role name is required',
                code: 'ROLE_NAME_REQUIRED',
            });
        }

        const resolvedGuard = this.resolveAndValidateGuard(guard);
        const normalizedTenantId = tenantId?.trim() || null;
        const roleTenantId = isSystem ? null : normalizedTenantId;

        return this.dataSource.transaction(async (manager) => {
            await this.ensureRoleIsUnique(manager, {
                name: normalizedName,
                guard: resolvedGuard,
                tenantId: roleTenantId,
            });

            const resolvedPermissions = await this.resolvePermissionsByNames(
                manager,
                permissionNames,
                resolvedGuard,
            );

            const role = manager.getRepository(NestAuthRole).create({
                name: normalizedName,
                guard: resolvedGuard,
                tenantId: roleTenantId,
                isSystem,
                isActive,
            });

            let savedRole: NestAuthRole;
            try {
                savedRole = await manager.getRepository(NestAuthRole).save(role);
            } catch (error) {
                if (isUniqueConstraintViolation(error)) {
                    throw new ConflictException({
                        message: this.buildRoleConflictMessage(normalizedName, resolvedGuard, roleTenantId),
                        code: 'ROLE_ALREADY_EXISTS',
                    });
                }
                throw error;
            }

            await this.replaceRolePermissions(manager, savedRole.id, resolvedPermissions);

            return this.getHydratedRole(manager, savedRole.id, true);
        });
    }

    async getRoleById(id: string, options?: FindOneOptions<NestAuthRole>): Promise<NestAuthRole> {
        if (!id) {
            return null;
        }

        return this.roleRepository.findOne({
            ...(options ? options : {}),
            where: { id },
            relations: Array.isArray(options?.relations)
                ? Array.from(new Set([...this.getRoleRelations(true), ...options.relations]))
                : this.getRoleRelations(true),
        });
    }

    async getRoleByName(
        name: string,
        guard?: string,
        tenantId?: string,
        options?: FindOneOptions<NestAuthRole>,
    ): Promise<NestAuthRole> {
        const relations = Array.isArray(options?.relations)
            ? Array.from(new Set([...this.getRoleRelations(true), ...options.relations]))
            : this.getRoleRelations(true);

        const systemRole = await this.roleRepository.findOne({
            ...(options ? options : {}),
            where: {
                name,
                ...(guard ? { guard } : {}),
                isSystem: true,
            },
            relations,
        });

        if (systemRole) {
            return systemRole;
        }

        return this.roleRepository.findOne({
            ...(options ? options : {}),
            where: {
                name,
                ...(guard ? { guard } : {}),
                ...(tenantId ? { tenantId } : { tenantId: IsNull() }),
            },
            relations,
        });
    }

    async getSystemRoles(options?: FindManyOptions<NestAuthRole>): Promise<NestAuthRole[]> {
        return this.roleRepository.find({
            ...(options ? options : {}),
            where: {
                isSystem: true,
                tenantId: IsNull(),
                ...(options?.where ? options.where : {}),
            },
            relations: Array.isArray(options?.relations)
                ? Array.from(new Set([...this.getRoleRelations(true), ...options.relations]))
                : this.getRoleRelations(true),
            order: {
                name: 'ASC',
            },
        });
    }

    async getRoles(
        params: {
            guard?: string;
            tenantId?: string;
            onlyTenantRoles?: boolean;
            onlySystemRoles?: boolean;
            includeTenant?: boolean;
        } = {},
        options?: FindManyOptions<NestAuthRole>,
    ): Promise<NestAuthRole[]> {
        const { guard, onlyTenantRoles, onlySystemRoles, includeTenant } = params;
        const { tenantId } = params;
        const query = this.roleRepository.createQueryBuilder('role');

        query
            .leftJoinAndSelect('role.rolePermissions', 'rolePermission')
            .leftJoinAndSelect('rolePermission.permission', 'permission')
            .distinct(true);

        if (guard) {
            query.andWhere('role.guard = :guard', { guard });
        }

        if (onlySystemRoles) {
            query.andWhere('role.isSystem = :isSystem', { isSystem: true });
        } else if (onlyTenantRoles) {
            if (!tenantId) {
                return [];
            }
            query.andWhere('role.tenantId = :tenantId', { tenantId });
        } else if (tenantId) {
            query.andWhere(new Brackets((qb) => {
                qb.where('role.tenantId = :tenantId', { tenantId })
                    .orWhere('role.isSystem = :isSystem', { isSystem: true });
            }));
        }

        if (includeTenant) {
            query.leftJoinAndSelect('role.tenant', 'tenant');
        }

        if (options?.where) {
            query.andWhere(options.where);
        }

        if (options?.order) {
            Object.entries(options.order).forEach(([key, value]) => {
                query.addOrderBy(`role.${key}`, value as 'ASC' | 'DESC');
            });
        } else {
            query.orderBy('role.name', 'ASC');
        }

        return query.getMany();
    }

    async updateRole(
        id: string,
        data: { name?: string; isActive?: boolean; permissions?: string | string[] },
    ): Promise<NestAuthRole> {
        return this.dataSource.transaction(async (manager) => {
            const role = await this.getHydratedRole(manager, id, true);

            if (!role) {
                throw new NotFoundException({
                    message: `Role with ID ${id} not found`,
                    code: 'ROLE_NOT_FOUND',
                });
            }

            const nextName = data.name !== undefined ? data.name.trim() : role.name;
            if (!nextName) {
                throw new BadRequestException({
                    message: 'Role name is required',
                    code: 'ROLE_NAME_REQUIRED',
                });
            }

            const shouldReplacePermissions = Object.prototype.hasOwnProperty.call(data, 'permissions');
            const nextPermissionNames = shouldReplacePermissions
                ? data.permissions
                : getRolePermissionNames(role);

            await this.ensureRoleIsUnique(manager, {
                id,
                name: nextName,
                guard: role.guard,
                tenantId: role.tenantId,
            });

            const resolvedPermissions = shouldReplacePermissions
                ? await this.resolvePermissionsByNames(manager, nextPermissionNames, role.guard)
                : [];

            role.name = nextName;

            if (data.isActive !== undefined) {
                role.isActive = data.isActive;
            }

            try {
                await manager.getRepository(NestAuthRole).save(role);
            } catch (error) {
                if (isUniqueConstraintViolation(error)) {
                    throw new ConflictException({
                        message: this.buildRoleConflictMessage(nextName, role.guard, role.tenantId),
                        code: 'ROLE_ALREADY_EXISTS',
                    });
                }
                throw error;
            }

            if (shouldReplacePermissions) {
                await this.replaceRolePermissions(manager, role.id, resolvedPermissions);
            }

            return this.getHydratedRole(manager, role.id, true);
        });
    }

    async updateRolePermissions(id: string, permissionNames: string | string[]): Promise<NestAuthRole> {
        return this.updateRole(id, { permissions: permissionNames });
    }

    async deleteRole(id: string): Promise<void> {
        const role = await this.getRoleById(id);

        if (!role) {
            throw new NotFoundException({
                message: `Role with ID ${id} not found`,
                code: 'ROLE_NOT_FOUND',
            });
        }

        await this.roleRepository.remove(role);
    }
}
