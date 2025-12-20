import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AdminCreatePermissionDto, AdminUpdatePermissionDto } from '../dto/admin-permission.dto';
import { PermissionService } from '../../permission/services/permission.service';
import { NestAuthPermission } from '../../permission/entities/permission.entity';
import { RoleService } from '../../role/services/role.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestAuthRole } from '../../role/entities/role.entity';

@Controller('auth/admin/api/permissions')
@UseGuards(AdminSessionGuard)
export class AdminPermissionsController {
    constructor(
        private readonly permissionService: PermissionService,
        private readonly roleService: RoleService,
        @InjectRepository(NestAuthRole)
        private roleRepository: Repository<NestAuthRole>,
    ) { }

    @Get()
    async listPermissions(
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('guard') guard?: string,
        @Query('limit') limit?: string,
    ) {
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const permissions = await this.permissionService.getPermissions({
            search,
            category,
            guard,
            limit: limitNum,
        });

        return {
            data: permissions.map((p) => this.toSafePermission(p)),
        };
    }

    @Get('guards')
    async getGuards() {
        const guards = await this.permissionService.getGuards();
        return { data: guards };
    }

    @Get('search')
    async searchPermissions(
        @Query('q') query: string,
        @Query('guard') guard?: string,
        @Query('limit') limit?: string,
    ) {
        if (!query || query.trim().length === 0) {
            return { data: [] };
        }

        const limitNum = limit ? parseInt(limit, 10) : 20;
        const permissions = await this.permissionService.searchPermissions(query.trim(), guard, limitNum);

        return {
            data: permissions.map((p) => this.toSafePermission(p)),
        };
    }

    @Get('categories')
    async getCategories() {
        const categories = await this.permissionService.getCategories();
        return { data: categories };
    }

    @Post()
    async createPermission(@Body() dto: AdminCreatePermissionDto) {
        const permission = await this.permissionService.createPermission({
            name: dto.name,
            guard: dto.guard,
            description: dto.description,
            category: dto.category,
            metadata: dto.metadata,
        });

        return {
            permission: this.toSafePermission(permission),
        };
    }

    @Get(':id')
    async getPermission(@Param('id') id: string) {
        try {
            const permission = await this.permissionService.getPermissionById(id);
            return {
                permission: this.toSafePermission(permission),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new NotFoundException('Permission not found');
        }
    }

    @Patch(':id')
    async updatePermission(
        @Param('id') id: string,
        @Body() dto: AdminUpdatePermissionDto,
    ) {
        const oldPermission = await this.permissionService.getPermissionById(id);
        const oldName = oldPermission.name;
        const oldGuard = oldPermission.guard;

        const permission = await this.permissionService.updatePermission(id, {
            name: dto.name,
            guard: dto.guard,
            description: dto.description,
            category: dto.category,
            metadata: dto.metadata,
        });

        // If name changed and user wants to update in roles, update all roles
        if (dto.name && dto.name !== oldName && dto.updateInRoles === true) {
            await this.updatePermissionInRoles(oldName, oldGuard, dto.name);
        }

        return {
            permission: this.toSafePermission(permission),
        };
    }

    /**
     * Update permission name in all roles that use it
     */
    private async updatePermissionInRoles(
        oldPermissionName: string,
        guard: string,
        newPermissionName: string,
    ): Promise<void> {
        // Find all roles with this guard that contain the old permission
        const roles = await this.roleRepository.find({
            where: { guard },
        });

        for (const role of roles) {
            if (role.permissions && role.permissions.includes(oldPermissionName)) {
                role.permissions = role.permissions.map(
                    (perm) => (perm === oldPermissionName ? newPermissionName : perm)
                );
                await this.roleRepository.save(role);
            }
        }
    }

    @Delete(':id')
    async deletePermission(@Param('id') id: string) {
        await this.permissionService.deletePermission(id);
        return { message: 'Permission deleted successfully' };
    }

    private toSafePermission(permission: NestAuthPermission) {
        return {
            id: permission.id,
            name: permission.name,
            guard: permission.guard,
            description: permission.description,
            category: permission.category,
            metadata: permission.metadata || {},
            createdAt: permission.createdAt,
            updatedAt: permission.updatedAt,
        };
    }
}
