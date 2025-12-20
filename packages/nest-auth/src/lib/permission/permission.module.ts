import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthPermission } from './entities/permission.entity';
import { PermissionService } from './services/permission.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthPermission]),
    ],
    providers: [PermissionService],
    exports: [PermissionService, TypeOrmModule],
})
export class PermissionModule { }

