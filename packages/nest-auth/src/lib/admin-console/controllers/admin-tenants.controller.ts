import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { AuthExceptionFilter } from '../../auth/filters/auth-exception.filter';
import { ApiTags, ApiCookieAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiUnauthorized, ApiForbidden, ApiValidationError, ApiNotFoundError } from '../../core';
import { TenantService } from '../../tenant/services/tenant.service';
import { AdminCreateTenantDto, AdminUpdateTenantDto } from '../dto/admin-tenant.dto';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';

@Controller('api/tenants')
@UseFilters(AuthExceptionFilter)
@UseGuards(AdminSessionGuard)
@ApiTags('Admin · Tenants')
@ApiCookieAuth('admin-session')
@ApiUnauthorized('Admin session missing or invalid.')
@ApiForbidden()
@ApiValidationError()
@ApiNotFoundError('Tenant not found.')
export class AdminTenantsController {
  constructor(private readonly tenants: TenantService) { }

  @ApiOperation({ summary: 'List tenants' })
  @Get()
  async listTenants() {
    const tenants = await this.tenants.getTenants({ order: { createdAt: 'DESC' } });
    return {
      data: tenants.map((tenant) => this.toSafeTenant(tenant)),
    };
  }

  @ApiOperation({ summary: 'Create a tenant' })
  @Post()
  async createTenant(@Body() dto: AdminCreateTenantDto) {
    const tenant = await this.tenants.createTenant({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      metadata: dto.metadata ?? {},
    });
    return { tenant: this.toSafeTenant(tenant) };
  }

  @ApiOperation({ summary: 'Update a tenant' })
  @Patch(':id')
  async updateTenant(@Param('id') id: string, @Body() dto: AdminUpdateTenantDto) {
    const tenant = await this.tenants.updateTenant(id, {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      metadata: dto.metadata ?? {},
    });
    return { tenant: this.toSafeTenant(tenant) };
  }

  @ApiOperation({ summary: 'Delete a tenant' })
  @Delete(':id')
  async deleteTenant(@Param('id') id: string) {
    await this.tenants.deleteTenant(id);
    return { message: 'Tenant removed' };
  }

  private toSafeTenant(tenant: NestAuthTenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      metadata: tenant.metadata ?? {},
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
