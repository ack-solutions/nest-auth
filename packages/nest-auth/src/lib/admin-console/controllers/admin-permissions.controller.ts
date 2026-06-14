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
import { ApiTags, ApiCookieAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiUnauthorized, ApiForbidden, ApiValidationError, ApiNotFoundError, Public } from '../../core';
import { AdminCreatePermissionDto, AdminUpdatePermissionDto } from '../dto/admin-permission.dto';
import { PermissionService } from '../../permission/services/permission.service';
import { NestAuthPermission } from '../../permission/entities/permission.entity';

@Controller('api/permissions')
@UseFilters(AuthExceptionFilter)
@UseGuards(AdminSessionGuard)
@ApiTags('Admin · Permissions')
@ApiCookieAuth('admin-session')
@ApiUnauthorized('Admin session missing or invalid.')
@ApiForbidden()
@ApiValidationError()
@ApiNotFoundError('Permission not found.')
@Public() // exempt from a consumer's global APP_GUARD; AdminSessionGuard is the real guard
export class AdminPermissionsController {
    constructor(
        private readonly permissionService: PermissionService,
    ) { }

    @ApiOperation({ summary: 'List permissions' })
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

    @ApiOperation({ summary: 'List guard namespaces' })
    @Get('guards')
    async getGuards() {
        const guards = await this.permissionService.getGuards();
        return { data: guards };
    }

    @ApiOperation({ summary: 'Search permissions' })
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

    @ApiOperation({ summary: 'List permission categories' })
    @Get('categories')
    async getCategories() {
        const categories = await this.permissionService.getCategories();
        return { data: categories };
    }

    @ApiOperation({ summary: 'Create a permission' })
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

    @ApiOperation({ summary: 'Get a permission' })
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

    @ApiOperation({ summary: 'Update a permission' })
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

    @ApiOperation({ summary: 'Delete a permission' })
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
