import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './services/tenant.service';
import { NestAuthTenant } from './entities/tenant.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        EventEmitterModule,
        TypeOrmModule.forFeature([NestAuthTenant]),
    ],
    providers: [
        TenantService,
    ],
    exports: [
        TenantService,
    ],
})
export class TenantModule { }
