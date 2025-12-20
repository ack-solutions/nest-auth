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

        tenantId = await this.tenantService.resolveTenantId(tenantId);

        // Check for existing role with same name in the same guard and tenant
        const existingRole = await this.roleRepository.findOne({
            where: {
                name,
                guard,
                tenantId: tenantId || IsNull()
            },
        });

        if (existingRole) {
            throw new ConflictException({
                message: `Role with name '${name}' already exists in guard '${guard}'${tenantId ? ` for tenant '${tenantId}'` : ''}`,
                code: 'ROLE_ALREADY_EXISTS'
            });
        }

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

        if (!onlySystemRoles) {
            tenantId = await this.tenantService.resolveTenantId(tenantId);
        }

        const query = this.roleRepository.createQueryBuilder();

        // const hasPagination = options?.skip !== undefined && options?.take !== undefined;

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
        // if (hasPagination) {
        //     query.skip(options.skip);
        //     query.take(options.take);

        //     return query.getManyAndCount();
        // }

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

        if (role.isSystem) {
            throw new ConflictException({
                message: 'Cannot update system role',
                code: 'SYSTEM_ROLE_UPDATE_ERROR',
            });
        }

        // Prevent changing system status and tenant
        delete data.isSystem;
        delete data.tenantId;

        // If name or guard is being changed, check for conflicts
        if ((data.name && data.name !== role.name) || (data.guard && data.guard !== role.guard)) {
            // First check for system role conflicts
            const systemRole = await this.getRoleByName(
                data.name || role.name,
                data.guard || role.guard
            );

            if (systemRole) {
                throw new ConflictException({
                    message: `Cannot use name '${data.name || role.name}' as it conflicts with a system role`,
                    code: 'SYSTEM_ROLE_CONFLICT'
                });
            }

            // Then check for tenant role conflicts
            const existingRole = await this.getRoleByName(
                data.name || role.name,
                data.guard || role.guard,
                role.tenantId
            );

            if (existingRole && existingRole.id !== role.id) {
                throw new ConflictException({
                    message: `Role with name '${data.name || role.name}' already exists in guard '${data.guard || role.guard}'${role.tenantId ? ` for tenant '${role.tenantId}'` : ''}`,
                    code: 'ROLE_ALREADY_EXISTS'
                });
            }
        }

        Object.assign(role, data);
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

        if (role.isSystem) {
            throw new BadRequestException({
                message: 'Cannot update system role',
                code: 'SYSTEM_ROLE_UPDATE_ERROR',
            });
        }

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

        if (role.isSystem) {
            throw new BadRequestException({
                message: 'Cannot delete system role',
                code: 'SYSTEM_ROLE_DELETE_ERROR',
            });
        }

        await this.roleRepository.remove(role);
    }

    async deleteSystemRole(id: string): Promise<void> {
        const role = await this.getRoleById(id);
        if (role?.isSystem) {
            await this.roleRepository.remove(role);
        }
    }
}
