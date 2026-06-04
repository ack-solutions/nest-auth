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
    UseFilters,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { AdminCreatePermissionDto, AdminUpdatePermissionDto } from '../dto/admin-permission.dto';
import { PermissionService } from '../../permission/services/permission.service';
import { NestAuthPermission } from '../../permission/entities/permission.entity';

@Controller('auth/admin/api/permissions')
@UseFilters(AuthExceptionFilter)
@UseGuards(AdminSessionGuard)
export class AdminPermissionsController {
    constructor(
        private readonly permissionService: PermissionService,
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
        const permission = await this.permissionService.updatePermission(id, {
            name: dto.name,
            category: dto.category,
            description: dto.description,
        });

        return {
            permission: this.toSafePermission(permission),
        };
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
            createdAt: permission.createdAt,
            updatedAt: permission.updatedAt,
        };
    }
}
