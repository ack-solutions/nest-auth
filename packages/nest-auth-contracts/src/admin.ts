/**
 * Admin Types
 * Administrative operations types
 */

export interface IAdminUser {
    id: string;
    email: string;
    name?: string;
    passwordHash: string;
    metadata?: Record<string, any>;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
