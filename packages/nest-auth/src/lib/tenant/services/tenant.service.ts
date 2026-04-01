import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { NestAuthTenant } from '../entities/tenant.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantCreatedEvent } from '../events/tenant-created.event';
import { TenantUpdatedEvent } from '../events/tenant-updated.event';
import { TenantDeletedEvent } from '../events/tenant-deleted.event';
import { ERROR_CODES, NestAuthEvents } from '../../auth.constants';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { isValidSlug } from '../../utils/slug.util';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { requiredTenant } from '../../utils';

@Injectable()
export class TenantService {

    constructor(
        @InjectRepository(NestAuthTenant)
        private tenantRepository: Repository<NestAuthTenant>,
        private eventEmitter: EventEmitter2,
        private debugLogger: DebugLoggerService,
        private readonly authConfigService: AuthConfigService,
    ) { }

    async createTenant(data: Partial<NestAuthTenant>): Promise<NestAuthTenant> {
        // Use slug (required)
        const identifier = data.slug;
        this.debugLogger.logTenantOperation('createTenant', undefined, { slug: data.slug, name: data.name });

        // Validate slug format
        if (!data.slug || !isValidSlug(data.slug)) {
            throw new BadRequestException({
                message: `Invalid slug format. Slug must be lowercase with only letters, numbers, hyphens (-) and underscores (_). Got: '${data.slug}'`,
                code: 'INVALID_SLUG_FORMAT'
            });
        }

        // Check for existing tenant with same slug
        this.debugLogger.debug('Checking for existing tenant', 'TenantService', { slug: data.slug });

        const existingTenant = await this.getTenantBySlug(data.slug);

        if (existingTenant) {
            this.debugLogger.warn('Tenant already exists', 'TenantService', { identifier, existingTenantId: existingTenant.id });
            throw new ConflictException({
                message: `Tenant with slug '${identifier}' already exists`,
                code: 'TENANT_ALREADY_EXISTS'
            });
        }

        const tenant = this.tenantRepository.create(data);
        await this.tenantRepository.save(tenant);

        // Emit tenant created event
        await this.eventEmitter.emitAsync(
            NestAuthEvents.TENANT_CREATED,
            new TenantCreatedEvent({
                tenant
            })
        );

        return tenant;
    }

    async getTenantById(id: string, options?: FindOneOptions<NestAuthTenant>): Promise<NestAuthTenant> {
        if (!id) {
            return null;
        }

        const tenant = await this.tenantRepository.findOne({
            ...(options ? options : {}),
            where: { id }
        });

        if (!tenant) {
            return null;
        }
        return tenant;
    }

    /**
     * Get tenant by slug
     */
    async getTenantBySlug(slug: string, options?: FindOneOptions<NestAuthTenant>): Promise<NestAuthTenant> {
        if (!slug) {
            return null;
        }

        const tenant = await this.tenantRepository.findOne({
            ...(options ? options : {}),
            where: { slug }
        });

        return tenant;
    }

    async getTenants(options?: FindManyOptions<NestAuthTenant>): Promise<NestAuthTenant[]> {
        return this.tenantRepository.find(options);
    }

    async updateTenant(id: string, data: Partial<NestAuthTenant>): Promise<NestAuthTenant> {
        const tenant = await this.getTenantById(id);

        if (!tenant) {
            throw new NotFoundException({
                message: `Tenant with ID ${id} not found`,
                code: 'TENANT_NOT_FOUND'
            });
        }

        // Validate slug format if being changed
        if (data.slug && !isValidSlug(data.slug)) {
            throw new BadRequestException({
                message: `Invalid slug format. Slug must be lowercase with only letters, numbers, hyphens (-) and underscores (_). Got: '${data.slug}'`,
                code: 'INVALID_SLUG_FORMAT'
            });
        }

        // If slug is being changed, check for conflicts
        if (data.slug && data.slug !== tenant.slug) {
            const existingTenant = await this.getTenantBySlug(data.slug);

            if (existingTenant && existingTenant.id !== tenant.id) {
                throw new ConflictException({
                    message: `Tenant with slug '${data.slug}' already exists`,
                    code: 'TENANT_ALREADY_EXISTS'
                });
            }
        }

        Object.assign(tenant, data);
        const updatedTenant = await this.tenantRepository.save(tenant);

        // Emit tenant updated event
        await this.eventEmitter.emitAsync(
            NestAuthEvents.TENANT_UPDATED,
            new TenantUpdatedEvent({
                tenant: updatedTenant,
                updatedFields: Object.keys(data)
            })
        );

        return updatedTenant;
    }

    async deleteTenant(id: string): Promise<void> {
        const tenant = await this.getTenantById(id);

        if (!tenant) {
            throw new NotFoundException({
                message: `Tenant with ID ${id} not found`,
                code: 'TENANT_NOT_FOUND'
            });
        }

        // Emit tenant deleted event before deletion
        await this.eventEmitter.emitAsync(
            NestAuthEvents.TENANT_DELETED,
            new TenantDeletedEvent({
                tenant
            })
        );

        await this.tenantRepository.remove(tenant);
    }

    async updateTenantStatus(id: string, isActive: boolean): Promise<NestAuthTenant> {
        const tenant = await this.getTenantById(id);

        if (!tenant) {
            throw new NotFoundException({
                message: `Tenant with ID ${id} not found`,
                code: 'TENANT_NOT_FOUND'
            });
        }

        tenant.isActive = isActive;
        const updatedTenant = await this.tenantRepository.save(tenant);
        return updatedTenant;
    }

    async updateTenantMetadata(id: string, metadata: Record<string, any>): Promise<NestAuthTenant> {
        const tenant = await this.getTenantById(id);

        if (!tenant) {
            throw new NotFoundException({
                message: `Tenant with ID ${id} not found`,
                code: 'TENANT_NOT_FOUND'
            });
        }

        tenant.metadata = {
            ...tenant.metadata,
            ...metadata
        };

        const updatedTenant = await this.tenantRepository.save(tenant);
        return updatedTenant;
    }

    async checkRequiredTenant(inputTenantId: string | null, throwError: boolean = true): Promise<boolean> {
        const config = this.authConfigService.getConfig();
        return requiredTenant(config?.tenant ?? {}, inputTenantId, throwError);
    }


    async resolveTenantId(inputTenantId?: string | null): Promise<string | null> {
        const config = this.authConfigService.getConfig();
        if (config.tenant?.enabled) {
            const mode = config.tenant?.mode ?? TenantModeEnum.ISOLATED;
            if (inputTenantId) {
                const tenant = await this.getTenantById(inputTenantId);
                if (!tenant) {
                    throw new BadRequestException({
                        message: `Tenant with ID '${inputTenantId}' not found`,
                        code: ERROR_CODES.TENANT_NOT_FOUND,
                    });
                }
            } else if (mode === TenantModeEnum.ISOLATED) {
                // In isolated mode, login requires an active tenant.
                throw new BadRequestException({
                    message: 'Tenant ID is required',
                    code: ERROR_CODES.TENANT_ID_REQUIRED,
                });
            } else {
                // In shared mode, allow login without selecting a tenant.
                // The client should call `/auth/switch-tenant` after user selection.
                return inputTenantId;
            }
        }

        return inputTenantId;
    }


}
