import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { NestAuthPermission } from '../entities/permission.entity';
import { DEFAULT_GUARD_NAME } from '../../auth.constants';

@Injectable()
export class PermissionService {
    constructor(
        @InjectRepository(NestAuthPermission)
        private permissionRepository: Repository<NestAuthPermission>,
    ) { }

    async createPermission(data: {
        name: string;
        guard?: string;
        description?: string;
        category?: string;
        metadata?: Record<string, any>;
    }): Promise<NestAuthPermission> {
        const guard = data.guard || DEFAULT_GUARD_NAME;
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
        data: {
            name?: string;
            guard?: string;
            description?: string;
            category?: string;
            metadata?: Record<string, any>;
        }
    ): Promise<NestAuthPermission> {
        const permission = await this.getPermissionById(id);
        const guard = data.guard || permission.guard;

        if (data.name && data.name !== permission.name) {
            // Check if new name already exists for this guard
            const existing = await this.permissionRepository.findOne({
                where: { name: data.name.trim(), guard },
            });
            if (existing) {
                throw new ConflictException(`Permission '${data.name}' with guard '${guard}' already exists`);
            }
            permission.name = data.name.trim();
        }

        if (data.guard && data.guard !== permission.guard) {
            // Check if permission with new guard already exists
            const existing = await this.permissionRepository.findOne({
                where: { name: permission.name, guard: data.guard },
            });
            if (existing) {
                throw new ConflictException(`Permission '${permission.name}' with guard '${data.guard}' already exists`);
            }
            permission.guard = data.guard;
        }

        if (data.description !== undefined) {
            permission.description = data.description?.trim() || null;
        }

        if (data.category !== undefined) {
            permission.category = data.category?.trim() || null;
        }

        if (data.metadata !== undefined) {
            permission.metadata = data.metadata || {};
        }

        return this.permissionRepository.save(permission);
    }

    async deletePermission(id: string): Promise<void> {
        const permission = await this.getPermissionById(id);
        await this.permissionRepository.remove(permission);
    }

    async getPermissionsByNames(names: string[]): Promise<NestAuthPermission[]> {
        if (names.length === 0) {
            return [];
        }
        return this.permissionRepository.find({
            where: names.map(name => ({ name })),
        });
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
        category?: string;
        metadata?: Record<string, any>;
    }>): Promise<NestAuthPermission[]> {
        const existing = await this.permissionRepository.find({
            where: permissions.map(p => ({ name: p.name })),
        });

        const existingNames = new Set(existing.map(p => p.name));
        const toCreate = permissions.filter(p => !existingNames.has(p.name));

        if (toCreate.length === 0) {
            return existing;
        }

        const newPermissions = this.permissionRepository.create(
            toCreate.map(p => ({
                name: p.name.trim(),
                description: p.description?.trim(),
                category: p.category?.trim(),
                metadata: p.metadata || {},
            }))
        );

        const saved = await this.permissionRepository.save(newPermissions);
        return [...existing, ...saved];
    }
}
