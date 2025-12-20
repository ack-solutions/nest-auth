import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminSessionGuard } from '../guards/admin-session.guard';
import { TenantService } from '../../tenant/services/tenant.service';
import { AdminCreateTenantDto, AdminUpdateTenantDto } from '../dto/admin-tenant.dto';
import { NestAuthTenant } from '../../tenant/entities/tenant.entity';

@Controller('auth/admin/api/tenants')
@UseGuards(AdminSessionGuard)
export class AdminTenantsController {
  constructor(private readonly tenants: TenantService) { }

  @Get()
  async listTenants() {
    const tenants = await this.tenants.getTenants({ order: { createdAt: 'DESC' } });
    return {
      data: tenants.map((tenant) => this.toSafeTenant(tenant)),
    };
  }

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
