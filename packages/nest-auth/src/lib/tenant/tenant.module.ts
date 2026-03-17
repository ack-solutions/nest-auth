import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './services/tenant.service';
import { NestAuthTenant } from './entities/tenant.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
    NEST_AUTH_TENANT_CONTEXT_SERVICE,
} from '../auth.constants';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { AuthConfigService } from '../core/services/auth-config.service';
import { DisabledTenantContextService } from './tenant-context/services/disabled-tenant-context.service';
import { IsolatedTenantContextService } from './tenant-context/services/isolated-tenant-context.service';
import { SharedTenantContextService } from './tenant-context/services/shared-tenant-context.service';

@Module({
    imports: [
        EventEmitterModule,
        TypeOrmModule.forFeature([NestAuthTenant]),
    ],
    providers: [
        TenantService,
        {
            provide: NEST_AUTH_TENANT_CONTEXT_SERVICE,
            useFactory: (
                tenantService: TenantService,
                authConfig: AuthConfigService,
            ) => {
                const opts = authConfig.getConfig().tenant;
                if (!opts?.enabled) {
                    return new DisabledTenantContextService();
                }

                const mode = opts.mode ?? TenantModeEnum.ISOLATED;
                if (mode === TenantModeEnum.SHARED) {
                    return new SharedTenantContextService(tenantService);
                }
                
                return new IsolatedTenantContextService(tenantService);
            },
            inject: [
                TenantService,
                AuthConfigService,
            ],
        },
    ],
    exports: [
        TenantService,
        NEST_AUTH_TENANT_CONTEXT_SERVICE,
    ],
})
export class TenantModule {}
