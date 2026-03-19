import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthRole } from './entities/role.entity';
import { NestAuthRolePermission } from './entities/role-permission.entity';
import { RoleService } from './services/role.service';
import { CoreModule } from '../core/core.module';
import { NestAuthPermission } from '../permission/entities/permission.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthRole, NestAuthPermission, NestAuthRolePermission]),
        CoreModule,
    ],
    providers: [RoleService],
    exports: [RoleService],
})
export class RoleModule { }
