import { Injectable, Logger } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';

export enum DebugLogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    VERBOSE = 'verbose'
}

export interface DebugLogOptions {
    enabled?: boolean;
    level?: DebugLogLevel;
    prefix?: string;
    includeTimestamp?: boolean;
    includeContext?: boolean;
}

@Injectable()
export class DebugLoggerService {
    private readonly logger = new Logger('NestAuth');
    private config: DebugLogOptions = {
        enabled: false,
        level: DebugLogLevel.VERBOSE,
        prefix: '[NestAuth]',
        includeTimestamp: true,
        includeContext: true
    };

    constructor(private readonly authConfig: AuthConfigService) {
        this.updateConfig();
    }

    private updateConfig(): void {
        const authOptions = this.authConfig.getConfig();
        if (authOptions.debug) {
            this.config = {
                ...this.config,
                ...authOptions.debug
            };
        }
    }

    private shouldLog(level: DebugLogLevel): boolean {
        if (!this.config.enabled) return false;

        const levels = [
            DebugLogLevel.ERROR,
            DebugLogLevel.WARN,
            DebugLogLevel.INFO,
            DebugLogLevel.DEBUG,
            DebugLogLevel.VERBOSE
        ];

        const currentLevelIndex = levels.indexOf(this.config.level);
        const requestedLevelIndex = levels.indexOf(level);

        return requestedLevelIndex <= currentLevelIndex;
    }

    private formatMessage(message: string, context?: string, data?: any): string {
        let formattedMessage = '';

        if (this.config.prefix) {
            formattedMessage += `${this.config.prefix} `;
        }

        if (this.config.includeTimestamp) {
            formattedMessage += `[${new Date().toISOString()}] `;
        }

        if (this.config.includeContext && context) {
            formattedMessage += `[${context}] `;
        }

        formattedMessage += message;

        if (data) {
            formattedMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
        }

        return formattedMessage;
    }

    error(message: string, context?: string, data?: any, trace?: string): void {
        if (this.shouldLog(DebugLogLevel.ERROR)) {
            this.logger.error(this.formatMessage(message, context, data), trace);
        }
    }

    warn(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.WARN)) {
            this.logger.warn(this.formatMessage(message, context, data));
        }
    }

    info(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.INFO)) {
            this.logger.log(this.formatMessage(message, context, data));
        }
    }

    debug(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.DEBUG)) {
            this.logger.debug(this.formatMessage(message, context, data));
        }
    }

    verbose(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.VERBOSE)) {
            this.logger.verbose(this.formatMessage(message, context, data));
        }
    }

    // Convenience methods for specific operations
    logUserOperation(operation: string, userId?: string, data?: any): void {
        this.debug(`User Operation: ${operation}`, 'UserService', {
            userId,
            operation,
            ...data
        });
    }

    logAuthOperation(operation: string, providerName?: string, userId?: string, data?: any): void {
        this.debug(`Auth Operation: ${operation}`, 'AuthService', {
            operation,
            providerName,
            userId,
            ...data
        });
    }

    logRoleOperation(operation: string, roleId?: string, data?: any): void {
        this.debug(`Role Operation: ${operation}`, 'RoleService', {
            operation,
            roleId,
            ...data
        });
    }

    logTenantOperation(operation: string, tenantId?: string, data?: any): void {
        this.debug(`Tenant Operation: ${operation}`, 'TenantService', {
            operation,
            tenantId,
            ...data
        });
    }

    logSessionOperation(operation: string, sessionId?: string, data?: any): void {
        this.debug(`Session Operation: ${operation}`, 'SessionService', {
            operation,
            sessionId,
            ...data
        });
    }

    logPermissionOperation(operation: string, permissionId?: string, data?: any): void {
        this.debug(`Permission Operation: ${operation}`, 'PermissionService', {
            operation,
            permissionId,
            ...data
        });
    }

    // Method to log errors with full context
    logError(error: Error, context: string, additionalData?: any): void {
        this.error(
            `Error in ${context}: ${error.message}`,
            context,
            {
                error: error.name,
                message: error.message,
                stack: error.stack,
                ...additionalData
            },
            error.stack
        );
    }

    // Method to log function entry/exit for detailed debugging
    logFunctionEntry(functionName: string, context: string, params?: any): void {
        this.verbose(`Entering function: ${functionName}`, context, { params });
    }

    logFunctionExit(functionName: string, context: string, result?: any): void {
        this.verbose(`Exiting function: ${functionName}`, context, { result });
    }
}
