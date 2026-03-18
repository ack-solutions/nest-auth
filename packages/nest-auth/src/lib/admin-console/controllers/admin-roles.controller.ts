import {
  BadRequestException,
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
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { RoleService } from '../../role/services/role.service';
import { AdminCreateRoleDto, AdminUpdateRoleDto } from '../dto/admin-role.dto';
import { NestAuthRole } from '../../role/entities/role.entity';
import { DEFAULT_GUARD_NAME } from '../../auth.constants';

@Controller('auth/admin/api/roles')
@UseGuards(AdminSessionGuard)
export class AdminRolesController {
  constructor(private readonly roles: RoleService) { }

  @Get()
  async listRoles(
    @Query('tenantId') tenantId?: string,
    @Query('guard') guard?: string,
  ) {
    const roles = await this.roles.getRoles({
      ...(guard ? { guard } : {}),
      ...(tenantId ? { tenantId } : {}),
      includeTenant: true,
    });
    return {
      data: roles.map((role) => this.toSafeRole(role)),
    };
  }

  @Post()
  async createRole(@Body() dto: AdminCreateRoleDto) {
    const role = await this.roles.createRole(
      dto.name,
      dto.guard ?? DEFAULT_GUARD_NAME,
      dto.tenantId,
      dto.isSystem ?? false,
      dto.permissions,
    );
    return { role: this.toSafeRole(role) };
  }

  @Patch(':id')
  async updateRole(@Param('id') id: string, @Body() dto: AdminUpdateRoleDto) {
    // Validate at least one field is provided
    if (!dto.permissions && dto.name === undefined && dto.guard === undefined && dto.isSystem === undefined) {
      throw new BadRequestException(
        'At least one field must be provided for update (permissions, name, guard, or isSystem)'
      );
    }

    // Apply updates sequentially without overwriting results
    if (dto.permissions) {
      await this.roles.updateRolePermissions(id, dto.permissions);
    }

    if (dto.name !== undefined || dto.guard !== undefined || dto.isSystem !== undefined) {
      await this.roles.updateRole(id, {
        name: dto.name,
        guard: dto.guard,
        isSystem: dto.isSystem,
      } as NestAuthRole);
    }

    // Fetch the final updated role once
    const role = await this.roles.getRoleById(id);
    return { role: this.toSafeRole(role) };
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string) {
    await this.roles.deleteRole(id);
    return { message: 'Role removed' };
  }

  private toSafeRole(role: NestAuthRole & { tenant?: { id: string; name: string; slug: string } }) {
    return {
      id: role.id,
      name: role.name,
      guard: role.guard,
      isSystem: role.isSystem,
      tenantId: role.tenantId,
      tenant: role.tenant ? { id: role.tenant.id, name: role.tenant.name, slug: role.tenant.slug } : undefined,
      permissions: role.permissions ?? [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
