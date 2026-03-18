import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthRole } from './entities/role.entity';
import { RoleService } from './services/role.service';
import { TenantModule } from '../tenant/tenant.module';
import { CoreModule } from '../core/core.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthRole]),
        TenantModule,
        CoreModule,
    ],
    providers: [RoleService],
    exports: [RoleService],
})
export class RoleModule { }
