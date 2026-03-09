import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantService } from '../../tenant/services/tenant.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthTenantUser } from '../../tenant/entities/tenant-user.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';

/**
 * Admin-only service for managing app users' tenant memberships.
 * Same database structure for isolated and shared: always use tenant_memberships (nest_auth_tenant_users).
 * - ISOLATED: one tenant per user (sync only first tenant).
 * - SHARED: multiple tenants per user.
 */
@Injectable()
export class AdminUserManagementService {
  constructor(
    @InjectRepository(NestAuthTenantUser)
    private readonly tenantUserRepository: Repository<NestAuthTenantUser>,
    private readonly tenantService: TenantService,
    private readonly authConfigService: AuthConfigService,
  ) {}

  private getTenantMode(): TenantModeEnum {
    return this.authConfigService.getConfig().tenantMode ?? TenantModeEnum.ISOLATED;
  }

  private async ensureTenantMembership(
    userId: string,
    tenantId: string,
  ): Promise<NestAuthTenantUser> {
    if (!userId || !tenantId) {
      return null;
    }
    const existing = await this.tenantUserRepository.findOne({
      where: { userId, tenantId },
    });
    if (existing) {
      return existing;
    }
    const membership = this.tenantUserRepository.create({
      userId,
      tenantId,
    });
    return await this.tenantUserRepository.save(membership);
  }

  /**
   * Sync a user's tenant memberships to the given list of tenant IDs (admin only).
   * Same table structure for both modes: always uses nest_auth_tenant_users.
   * - ISOLATED: only first tenant is synced (one membership).
   * - SHARED: all resolved tenant IDs are synced (multiple memberships).
   */
  async syncTenantUsers(
    userId: string,
    tenantIds: string[],
  ): Promise<NestAuthTenantUser[]> {
    if (!userId) {
      return [];
    }

    const tenantMode = this.getTenantMode();

    if (tenantMode === TenantModeEnum.ISOLATED) {
      // One tenant per user: sync only the first, deactivate any others
      if (tenantIds?.length) {
        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantIds[0]);
        if (resolvedTenantId) {
          const existing = await this.tenantUserRepository.find({ where: { userId } });
          const toDeactivate = existing.filter((m) => m.tenantId !== resolvedTenantId && m.isActive);
          if (toDeactivate.length) {
            toDeactivate.forEach((m) => { m.isActive = false; });
            await this.tenantUserRepository.save(toDeactivate);
          }
          await this.ensureTenantMembership(userId, resolvedTenantId);
          return this.tenantUserRepository.find({
            where: { userId, isActive: true },
            relations: ['tenant'],
          });
        }
      }
      return [];
    }

    // SHARED: multiple tenants per user
    const resolvedTenantIds = (
      await Promise.all(
        (tenantIds || [])
          .map((id) => (id ? id.trim() : ''))
          .filter(Boolean)
          .map((id) => this.tenantService.resolveTenantId(id)),
      )
    ).filter(Boolean);

    if (resolvedTenantIds.length === 0) {
      const existingMemberships = await this.tenantUserRepository.find({ where: { userId } });
      const updates = existingMemberships
        .filter((m) => m.isActive)
        .map((m) => {
          m.isActive = false;
          return m;
        });
      if (updates.length) {
        await this.tenantUserRepository.save(updates);
      }
      return [];
    }

    const existingMemberships = await this.tenantUserRepository.find({ where: { userId } });
    const membershipByTenant = new Map(existingMemberships.map((m) => [m.tenantId, m]));

    const updates: NestAuthTenantUser[] = [];

    for (const membership of existingMemberships) {
      const shouldBeActive = resolvedTenantIds.includes(membership.tenantId);
      if (membership.isActive !== shouldBeActive) {
        membership.isActive = shouldBeActive;
        updates.push(membership);
      }
    }

    for (const tenantId of resolvedTenantIds) {
      if (!membershipByTenant.has(tenantId)) {
        updates.push(
          this.tenantUserRepository.create({
            userId,
            tenantId,
            isActive: true,
          }),
        );
      }
    }

    if (updates.length) {
      await this.tenantUserRepository.save(updates);
    }

    return this.tenantUserRepository.find({
      where: { userId, isActive: true },
      relations: ['tenant'],
    });
  }
}
