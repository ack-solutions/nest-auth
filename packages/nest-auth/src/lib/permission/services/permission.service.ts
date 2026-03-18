import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { NestAuthPermission } from '../entities/permission.entity';
import { DEFAULT_GUARD_NAME, GUARD_ERROR_CODES } from '../../auth.constants';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { IUpdatePermissionInput } from '@ackplus/nest-auth-contracts';

@Injectable()
export class PermissionService {
    constructor(
        @InjectRepository(NestAuthPermission)
        private permissionRepository: Repository<NestAuthPermission>,
        private authConfigService: AuthConfigService,
    ) { }

    private getDefaultRoleGuard(): string {
        return this.authConfigService.getRoleGuards()[0] ?? DEFAULT_GUARD_NAME;
    }

    private resolveAndValidateGuard(guard: string | null | undefined): string {
        const resolved = guard ?? this.getDefaultRoleGuard();
        if (!this.authConfigService.isRoleGuardAllowed(resolved)) {
            throw new BadRequestException({
                message: `Guard '${resolved}' is not allowed. Allowed guards: ${this.authConfigService.getRoleGuards().join(', ')}`,
                code: GUARD_ERROR_CODES.GUARD_NOT_ALLOWED,
            });
        }
        return resolved;
    }

    async createPermission(data: {
        name: string;
        guard?: string;
        description?: string;
        category?: string;
        metadata?: Record<string, any>;
    }): Promise<NestAuthPermission> {
        const guard = this.resolveAndValidateGuard(data.guard);
        const existing = await this.permissionRepository.findOne({
            where: { name: data.name.trim(), guard },
        });

        if (existing) {
            throw new ConflictException(`Permission '${data.name}' with guard '${guard}' already exists`);
        }

        const permission = this.permissionRepository.create({
            name: data.name.trim(),
            guard,
            description: data.description?.trim(),
            category: data.category?.trim(),
            metadata: data.metadata || {},
        });

        return this.permissionRepository.save(permission);
    }

    async getPermissions(options?: {
        search?: string;
        category?: string;
        guard?: string;
        limit?: number;
    }): Promise<NestAuthPermission[]> {
        const query = this.permissionRepository.createQueryBuilder('permission');

        if (options?.search) {
            query.where(
                '(permission.name LIKE :search OR permission.description LIKE :search)',
                { search: `%${options.search}%` }
            );
        }

        if (options?.category) {
            query.andWhere('permission.category = :category', { category: options.category });
        }

        if (options?.guard) {
            query.andWhere('permission.guard = :guard', { guard: options.guard });
        }

        query.orderBy('permission.name', 'ASC');

        if (options?.limit) {
            query.limit(options.limit);
        }

        return query.getMany();
    }

    async getPermissionByName(name: string, guard?: string): Promise<NestAuthPermission | null> {
        return this.permissionRepository.findOne({
            where: { name, guard: guard || DEFAULT_GUARD_NAME },
        });
    }

    async getPermissionsByGuard(guard: string): Promise<NestAuthPermission[]> {
        return this.permissionRepository.find({
            where: { guard },
            order: { name: 'ASC' },
        });
    }

    async getGuards(): Promise<string[]> {
        const result = await this.permissionRepository
            .createQueryBuilder('permission')
            .select('DISTINCT permission.guard', 'guard')
            .getRawMany();

        return result.map(r => r.guard).filter(Boolean).sort();
    }

    async getPermissionById(id: string): Promise<NestAuthPermission> {
        const permission = await this.permissionRepository.findOne({
            where: { id },
        });

        if (!permission) {
            throw new NotFoundException(`Permission with id ${id} not found`);
        }

        return permission;
    }

    async updatePermission(
        id: string,
        data: IUpdatePermissionInput,
    ): Promise<NestAuthPermission> {
        const permission = await this.permissionRepository.findOne({
            where: { id },
        });
        if (!permission) {
            throw new NotFoundException(`Permission with id ${id} not found`);
        }

        if (data.name !== undefined && data.name.trim() !== permission.name) {
            const newName = data.name.trim();
            const existing = await this.permissionRepository.findOne({
                where: { name: newName, guard: permission.guard },
            });
            if (existing) {
                throw new ConflictException(
                    `Permission '${newName}' with guard '${permission.guard}' already exists`,
                );
            }
            permission.name = newName;
        }

        if (data.description !== undefined) {
            permission.description = data.description?.trim() || null;
        }

        if (data.category !== undefined) {
            permission.category = data.category?.trim() || null;
        }

        return this.permissionRepository.save(permission);
    }

    async deletePermission(id: string): Promise<void> {
        const permission = await this.getPermissionById(id);
        await this.permissionRepository.remove(permission);
    }


    async searchPermissions(query: string, guard?: string, limit: number = 20): Promise<NestAuthPermission[]> {
        const whereConditions: any[] = [
            { name: Like(`%${query}%`) },
            { description: Like(`%${query}%`) },
        ];

        if (guard) {
            // Apply guard filter to all conditions
            whereConditions.forEach(condition => {
                condition.guard = guard;
            });
        }

        return this.permissionRepository.find({
            where: whereConditions,
            take: limit,
            order: { name: 'ASC' },
        });
    }

    async getCategories(): Promise<string[]> {
        const result = await this.permissionRepository
            .createQueryBuilder('permission')
            .select('DISTINCT permission.category', 'category')
            .where('permission.category IS NOT NULL')
            .getRawMany();

        return result.map(r => r.category).filter(Boolean).sort();
    }

    /**
     * Batch create permissions - useful for seeding
     */
    async createPermissions(permissions: Array<{
        name: string;
        description?: string;
        guard?: string;
        category?: string;
        metadata?: Record<string, any>;
    }>): Promise<NestAuthPermission[]> {
        const existingPermissions = await this.permissionRepository.find();


        const existingKeySet = new Set(existingPermissions.map((p) => `${p.name}-${p.guard}`));
        const toCreatePermissions = permissions.filter(p => !existingKeySet.has(`${p.name}-${p.guard}`));

        if (toCreatePermissions.length === 0) {
            return existingPermissions;
        }

        const newPermissions = this.permissionRepository.create(
            toCreatePermissions.map(p => ({
                name: p.name.trim(),
                description: p.description?.trim(),
                guard: p.guard || DEFAULT_GUARD_NAME,
                category: p.category?.trim(),
                metadata: p.metadata || {},
            }))
        );

        const saved = await this.permissionRepository.save(newPermissions);
        return [...existingPermissions, ...saved];
    }
}
