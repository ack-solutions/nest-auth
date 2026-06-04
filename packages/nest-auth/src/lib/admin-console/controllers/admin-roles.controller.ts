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
  UseFilters,
} from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { RoleService } from '../../role/services/role.service';
import { AdminCreateRoleDto, AdminUpdateRoleDto } from '../dto/admin-role.dto';
import { DEFAULT_GUARD_NAME } from '../../auth.constants';
import { mapRoleToResponse } from '../../role/utils/role-mapper.util';

@Controller('auth/admin/api/roles')
@UseFilters(AuthExceptionFilter)
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
      dto.isActive ?? true,
    );
    return { role: this.toSafeRole(role) };
  }

  @Patch(':id')
  async updateRole(@Param('id') id: string, @Body() dto: AdminUpdateRoleDto) {
    if (
      dto.permissions === undefined
      && dto.name === undefined
      && dto.isActive === undefined
    ) {
      throw new BadRequestException(
        'At least one field must be provided for update (name, isActive, or permissions)',
      );
    }

    const updateData: { name?: string; isActive?: boolean; permissions?: string[] } = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions;

    const role = await this.roles.updateRole(id, updateData);
    return { role: this.toSafeRole(role) };
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string) {
    await this.roles.deleteRole(id);
    return { message: 'Role removed' };
  }

  private toSafeRole(role: Parameters<typeof mapRoleToResponse>[0]) {
    return mapRoleToResponse(role);
  }
}
