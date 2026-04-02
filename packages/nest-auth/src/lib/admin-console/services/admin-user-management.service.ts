import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantService } from '../../tenant/services/tenant.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { NestAuthUserAccess } from '../../user/entities/user-access.entity';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';

/**
 * Admin-only service for managing user access (tenant + roles).
 * Uses nest_auth_user_accesses.
 * - ISOLATED: one tenant per user (sync only first tenant).
 * - SHARED: multiple tenants per user.
 */
@Injectable()
export class AdminUserManagementService {
  constructor(
    @InjectRepository(NestAuthUserAccess)
    private readonly userAccessRepository: Repository<NestAuthUserAccess>,
    private readonly tenantService: TenantService,
    private readonly authConfigService: AuthConfigService,
  ) { }

  private getTenantMode(): TenantModeEnum {
    const config = this.authConfigService.getConfig();
    const mode = config.tenant?.mode;
    return mode === TenantModeEnum.SHARED ? TenantModeEnum.SHARED : TenantModeEnum.ISOLATED;
  }

  private async ensureUserAccess(
    userId: string,
    tenantId: string,
  ): Promise<NestAuthUserAccess | null> {
    if (!userId || !tenantId) {
      return null;
    }
    const existing = await this.userAccessRepository.findOne({
      where: { userId, tenantId },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await this.userAccessRepository.save(existing);
      }
      return existing;
    }
    const access = this.userAccessRepository.create({
      userId,
      tenantId,
    });
    return await this.userAccessRepository.save(access);
  }

  /**
   * Sync a user's accesses to the given list of tenant IDs (admin only).
   * - ISOLATED: only first tenant is synced.
   * - SHARED: all resolved tenant IDs are synced.
   */
  async syncUserAccesses(
    userId: string,
    tenantIds: string[],
  ): Promise<NestAuthUserAccess[]> {
    if (!userId) {
      return [];
    }

    const tenantMode = this.getTenantMode();

    if (tenantMode === TenantModeEnum.ISOLATED) {
      if (tenantIds?.length) {
        const resolvedTenantId = await this.tenantService.resolveTenantId(tenantIds[0]);
        if (resolvedTenantId) {
          const existing = await this.userAccessRepository.find({ where: { userId } });
          const toDeactivate = existing.filter((a) => a.tenantId !== resolvedTenantId && a.isActive);
          if (toDeactivate.length) {
            toDeactivate.forEach((a) => { a.isActive = false; });
            await this.userAccessRepository.save(toDeactivate);
          }
          await this.ensureUserAccess(userId, resolvedTenantId);
          return this.userAccessRepository.find({
            where: { userId, isActive: true },
            relations: ['tenant'],
          });
        }
      }
      return [];
    }

    const resolvedTenantIds = (
      await Promise.all(
        (tenantIds || [])
          .map((id) => (id ? id.trim() : ''))
          .filter(Boolean)
          .map((id) => this.tenantService.resolveTenantId(id)),
      )
    ).filter(Boolean);

    if (resolvedTenantIds.length === 0) {
      const existingList = await this.userAccessRepository.find({ where: { userId } });
      const updates = existingList
        .filter((a) => a.isActive)
        .map((a) => {
          a.isActive = false;
          return a;
        });
      if (updates.length) {
        await this.userAccessRepository.save(updates);
      }
      return [];
    }

    const existingList = await this.userAccessRepository.find({ where: { userId } });
    const accessByTenant = new Map(existingList.map((a) => [a.tenantId, a]));
    const tenantIdSet = new Set(resolvedTenantIds);

    const updates: NestAuthUserAccess[] = [];

    for (const access of existingList) {
      const shouldBeActive = tenantIdSet.has(access.tenantId);
      if (access.isActive !== shouldBeActive) {
        access.isActive = shouldBeActive;
        updates.push(access);
      }
    }

    for (const tenantId of resolvedTenantIds) {
      if (!accessByTenant.has(tenantId)) {
        updates.push(
          this.userAccessRepository.create({
            userId,
            tenantId,
            isActive: true,
          }),
        );
      }
    }

    if (updates.length) {
      await this.userAccessRepository.save(updates);
    }

    return this.userAccessRepository.find({
      where: { userId, isActive: true },
      relations: ['tenant'],
    });
  }
}
