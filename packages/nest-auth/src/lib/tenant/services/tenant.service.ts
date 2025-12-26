import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { NestAuthTenant } from '../entities/tenant.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantCreatedEvent } from '../events/tenant-created.event';
import { TenantUpdatedEvent } from '../events/tenant-updated.event';
import { TenantDeletedEvent } from '../events/tenant-deleted.event';
import { NestAuthEvents } from '../../auth.constants';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { DebugLoggerService } from '../../core/services/debug-logger.service';
import { isValidSlug, toSlug } from '../../utils/slug.util';

@Injectable()
export class TenantService {

    private defaultTenant: NestAuthTenant | null = null;

    constructor(
        @InjectRepository(NestAuthTenant)
        private tenantRepository: Repository<NestAuthTenant>,
        private eventEmitter: EventEmitter2,
        private authConfig: AuthConfigService,
        private debugLogger: DebugLoggerService
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

    async initializeDefaultTenant(): Promise<NestAuthTenant | null> {
        const config = this.authConfig.getConfig();

        if (!config.defaultTenant) {
            return null;
        }

        // Support both slug and domain for backward compatibility
        // Prefer slug over domain
        const identifier = config.defaultTenant.slug;

        if (!identifier) {
            throw new BadRequestException({
                message: 'defaultTenant must have "slug" field',
                code: 'MISSING_TENANT_IDENTIFIER'
            });
        }

        // Validate slug format if provided
        if (config.defaultTenant.slug && !isValidSlug(config.defaultTenant.slug)) {
            throw new BadRequestException({
                message: `Invalid slug format in defaultTenant. Slug must be lowercase with only letters, numbers, hyphens (-) and underscores (_). Got: '${config.defaultTenant.slug}'`,
                code: 'INVALID_SLUG_FORMAT'
            });
        }

        // Check if default tenant already exists
        let defaultTenant: NestAuthTenant | null = null;

        if (config.defaultTenant.slug) {
            defaultTenant = await this.getTenantBySlug(config.defaultTenant.slug);
        }

        if (!defaultTenant) {
            // Create the default tenant
            try {
                defaultTenant = await this.createTenant({
                    name: config.defaultTenant.name,
                    slug: config.defaultTenant.slug || null,
                    description: config.defaultTenant.description || 'Default tenant',
                    metadata: config.defaultTenant.metadata || {},
                    isActive: true
                });
            } catch (error) {
                // If tenant already exists, try to find it
                if (error.code === 'TENANT_ALREADY_EXISTS') {
                    if (config.defaultTenant.slug) {
                        defaultTenant = await this.getTenantBySlug(config.defaultTenant.slug);
                    }
                }

                if (!defaultTenant) {
                    throw error;
                }
            }
        }

        this.defaultTenant = defaultTenant;
        return defaultTenant;
    }

    getDefaultTenant(): NestAuthTenant | null {
        return this.defaultTenant;
    }

    getDefaultTenantId(): string | null {
        return this.defaultTenant?.id || null;
    }

    async getOrCreateDefaultTenant(): Promise<NestAuthTenant | null> {
        if (this.defaultTenant) {
            return this.defaultTenant;
        }

        return await this.initializeDefaultTenant();
    }

    async resolveTenantId(providedTenantId?: string | null): Promise<string | null> {
        this.debugLogger.logTenantOperation('resolveTenantId', providedTenantId, { providedTenantId });

        // If tenant ID is explicitly provided, use it
        if (providedTenantId) {
            this.debugLogger.debug('Using provided tenant ID', 'TenantService', { tenantId: providedTenantId });
            return providedTenantId;
        }

        // If no tenant ID provided, try to get default tenant
        const defaultTenant = await this.getOrCreateDefaultTenant();
        const resolvedTenantId = defaultTenant?.id || null;
        this.debugLogger.debug('Resolved tenant ID', 'TenantService', { resolvedTenantId, hasDefaultTenant: !!defaultTenant });
        return resolvedTenantId;
    }

}
