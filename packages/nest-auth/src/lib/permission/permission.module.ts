import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthPermission } from './entities/permission.entity';
import { PermissionService } from './services/permission.service';
import { CoreModule } from '../core/core.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthPermission]),
        CoreModule,
    ],
    providers: [PermissionService],
    exports: [PermissionService, TypeOrmModule],
})
export class PermissionModule { }

