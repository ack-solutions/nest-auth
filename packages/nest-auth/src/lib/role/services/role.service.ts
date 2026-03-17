import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, IsNull, Repository, Brackets } from 'typeorm';
import { NestAuthRole } from '../entities/role.entity';
import { TenantService } from '../../tenant';

@Injectable()
export class RoleService {
    constructor(
        @InjectRepository(NestAuthRole)
        private roleRepository: Repository<NestAuthRole>,
        private tenantService: TenantService,
    ) { }

    async createRole(
        name: string,
        guard: string,
        tenantId: string | null = null,
        isSystem: boolean = false,
        permissionIds?: string | string[],
    ): Promise<NestAuthRole> {

        const role = await NestAuthRole.createRole(name, guard, isSystem, tenantId);

        if (permissionIds) {
            await role.syncPermissions(permissionIds);
        }

        await this.roleRepository.save(role);
        return role;

    }

    async getRoleById(id: string, options?: FindOneOptions<NestAuthRole>): Promise<NestAuthRole> {
        if (!id) {
            return null;
        }

        const role = await this.roleRepository.findOne({
            ...(options ? options : {}),
            where: { id }
        });
        if (!role) {
            return null;
        }
        return role;
    }

    async getRoleByName(
        name: string,
        guard?: string,
        tenantId?: string,
        options?: FindOneOptions<NestAuthRole>
    ): Promise<NestAuthRole> {
        // First check for system roles with this name
        const systemRole = await this.roleRepository.findOne({
            ...(options ? options : {}),
            where: {
                name,
                ...(guard ? { guard } : {}),
                isSystem: true
            }
        });

        if (systemRole) {
            return systemRole;
        }

        // Then check for tenant-specific roles
        const role = await this.roleRepository.findOne({
            ...(options ? options : {}),
            where: {
                name,
                ...(guard ? { guard } : {}),
                ...(tenantId ? { tenantId } : { tenantId: IsNull() })
            }
        });

        return role;
    }

    async getSystemRoles(options?: FindManyOptions<NestAuthRole>): Promise<NestAuthRole[]> {
        return this.roleRepository.find({
            ...(options ? options : {}),
            where: {
                isSystem: true,
                tenantId: IsNull(),
                ...(options?.where ? options.where : {})
            },
            order: {
                name: 'ASC'
            }
        });
    }

    /**
     * Get roles
     * @param params
     * @param options
     * @returns
     */
    async getRoles(
        params: {
            guard?: string;
            tenantId?: string;
            onlyTenantRoles?: boolean;
            onlySystemRoles?: boolean;
        } = {},
        options?: FindManyOptions<NestAuthRole>
    ): Promise<NestAuthRole[]> {
        const { guard, onlyTenantRoles, onlySystemRoles } = params;
        let { tenantId } = params;
        const query = this.roleRepository.createQueryBuilder();

        if (guard) {
            query.andWhere(`${query.alias}.guard = :guard`, { guard });
        }

        if (onlySystemRoles) {
            query.andWhere(`${query.alias}.isSystem = :isSystem`, { isSystem: true });
        } else if (onlyTenantRoles) {
            if (!tenantId) {
                return [];
            }
            query.andWhere(`${query.alias}.tenantId = :tenantId`, { tenantId });
        } else {
            if (tenantId) {
                query.andWhere(new Brackets(qb => {
                    qb.where(`${query.alias}.tenantId = :tenantId`, { tenantId })
                        .orWhere(`${query.alias}.isSystem = :isSystem`, { isSystem: true });
                }));
            } else {
                query.andWhere(`${query.alias}.isSystem = :isSystem`, { isSystem: true });
            }
        }

        if (options) {
            if (options.where) {
                query.andWhere(options.where);
            }
            if (options.order) {
                Object.entries(options.order).forEach(([key, value]) => {
                    query.addOrderBy(`${query.alias}.${key}`, value as 'ASC' | 'DESC');
                });
            }
        } else {
            query.orderBy(`${query.alias}.name`, 'ASC');
        }
        query.take(1000);

        return query.getMany();
    }

    async updateRole(id: string, data: Partial<NestAuthRole>): Promise<NestAuthRole> {
        const role = await this.getRoleById(id);

        if (!role) {
            throw new NotFoundException({
                message: `Role with ID ${id} not found`,
                code: 'ROLE_NOT_FOUND'
            });
        }

        // Prevent changing tenantId directly
        delete data.tenantId;

        // Handle name update - check for conflicts
        if (data.name !== undefined && data.name !== role.name) {
            const newName = data.name;
            const newGuard = data.guard !== undefined ? data.guard : role.guard;
            const newIsSystem = data.isSystem !== undefined ? data.isSystem : role.isSystem;
            const newTenantId = newIsSystem ? null : role.tenantId;

            // Check for existing role with same name, guard, and tenantId
            const existingRole = await this.roleRepository.findOne({
                where: {
                    name: newName,
                    guard: newGuard,
                    tenantId: newTenantId || IsNull()
                }
            });

            if (existingRole && existingRole.id !== id) {
                throw new ConflictException({
                    message: `Role with name '${newName}' already exists in guard '${newGuard}'${newTenantId ? ` for tenant '${newTenantId}'` : ''}`,
                    code: 'ROLE_ALREADY_EXISTS'
                });
            }
            role.name = newName;
        }

        // Handle guard update - check for conflicts
        if (data.guard !== undefined && data.guard !== role.guard) {
            const newName = data.name !== undefined ? data.name : role.name;
            const newGuard = data.guard;
            const newIsSystem = data.isSystem !== undefined ? data.isSystem : role.isSystem;
            const newTenantId = newIsSystem ? null : role.tenantId;

            // Check for existing role with same name, guard, and tenantId
            const existingRole = await this.roleRepository.findOne({
                where: {
                    name: newName,
                    guard: newGuard,
                    tenantId: newTenantId || IsNull()
                }
            });

            if (existingRole && existingRole.id !== id) {
                throw new ConflictException({
                    message: `Role with name '${newName}' already exists in guard '${newGuard}'${newTenantId ? ` for tenant '${newTenantId}'` : ''}`,
                    code: 'ROLE_ALREADY_EXISTS'
                });
            }
            role.guard = newGuard;
        }

        // Handle isSystem update
        if (data.isSystem !== undefined && data.isSystem !== role.isSystem) {
            const newIsSystem = data.isSystem;
            const newName = data.name !== undefined ? data.name : role.name;
            const newGuard = data.guard !== undefined ? data.guard : role.guard;
            const newTenantId = newIsSystem ? null : role.tenantId;

            // If changing to system role, tenantId must be null
            // If changing from system role, we need a tenantId (but we can't set it here, so we'll keep the existing one or throw error)
            if (newIsSystem) {
                role.tenantId = null;
            } else {
                // If changing from system to non-system, we need a tenantId
                // But we can't set it here, so we'll throw an error
                if (!role.tenantId) {
                    throw new BadRequestException({
                        message: 'Cannot change system role to non-system role without a tenant. Please assign a tenant first.',
                        code: 'SYSTEM_ROLE_TENANT_REQUIRED'
                    });
                }
            }

            // Check for conflicts with the new isSystem status
            const existingRole = await this.roleRepository.findOne({
                where: {
                    name: newName,
                    guard: newGuard,
                    tenantId: newTenantId || IsNull()
                }
            });

            if (existingRole && existingRole.id !== id) {
                throw new ConflictException({
                    message: `Role with name '${newName}' already exists in guard '${newGuard}'${newTenantId ? ` for tenant '${newTenantId}'` : ''}`,
                    code: 'ROLE_ALREADY_EXISTS'
                });
            }

            role.isSystem = newIsSystem;
        }

        // Apply any other fields
        const { name, guard, isSystem, tenantId, ...otherData } = data;
        Object.assign(role, otherData);

        return this.roleRepository.save(role);
    }

    async updateRolePermissions(id: string, permissionIds: string | string[]): Promise<NestAuthRole> {
        const role = await this.getRoleById(id);

        if (!role) {
            throw new NotFoundException({
                message: `Role with ID ${id} not found`,
                code: 'ROLE_NOT_FOUND'
            });
        }

        // Permission updates are allowed for ALL roles including system roles
        await role.syncPermissions(permissionIds);
        return this.roleRepository.save(role);
    }

    async deleteRole(id: string): Promise<void> {
        const role = await this.getRoleById(id);

        if (!role) {
            throw new NotFoundException({
                message: `Role with ID ${id} not found`,
                code: 'ROLE_NOT_FOUND'
            });
        }

        await this.roleRepository.remove(role);
    }
}
