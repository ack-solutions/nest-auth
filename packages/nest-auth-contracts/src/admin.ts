/**
 * Admin Types
 * Administrative operations types
 */

import { IUserResponse } from './auth';

/**
 * Initialize admin request
 */
export interface IInitializeAdminRequest {
    email: string;
    password: string;
    secretKey?: string;
    tenantId?: string;
    metadata?: Record<string, any>;
}

/**
 * Initialize admin response
 */
export interface IInitializeAdminResponse {
    message: string;
    user: IUserResponse;
    role: string;
}

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
