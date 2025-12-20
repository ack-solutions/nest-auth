import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantService } from '../../tenant/services/tenant.service';
import { AuthConfigService } from './auth-config.service';

@Injectable()
export class InitializationService implements OnModuleInit {
    constructor(
        private readonly tenantService: TenantService,
        private readonly authConfig: AuthConfigService,
    ) { }

    async onModuleInit() {
        // Initialize default tenant if configured
        await this.initializeDefaultTenant();
    }

    private async initializeDefaultTenant(): Promise<void> {
        try {
            const config = this.authConfig.getConfig();

            if (config.defaultTenant) {
                await this.tenantService.initializeDefaultTenant();
            }
        } catch (error) {
            // Log the error but don't fail module initialization
            console.error('Failed to initialize default tenant:', error);
        }
    }
}
