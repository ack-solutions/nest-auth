import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
    /**
     * If true, uses console.log directly instead of NestJS Logger
     * This bypasses NestJS log level filtering which may hide debug/verbose logs
     * @default false
     */
    useConsole?: boolean;
}

@Injectable()
export class DebugLoggerService implements OnModuleInit {
    private readonly logger = new Logger('NestAuth');
    private defaultConfig: DebugLogOptions = {
        enabled: false,
        level: DebugLogLevel.VERBOSE,
        prefix: '[NestAuth]',
        includeTimestamp: true,
        includeContext: true,
        useConsole: false
    };

    constructor(private readonly authConfig: AuthConfigService) {}

    /**
     * Called when the module is initialized
     * Logs a startup message if debug is enabled
     */
    onModuleInit(): void {
        const config = this.getConfig();
        if (config.enabled) {
            // Use console.log directly to ensure this message is always visible
            // regardless of NestJS log level settings
            console.log(
                '\x1b[36m%s\x1b[0m', // Cyan color
                `${config.prefix || '[NestAuth]'} Debug logging ENABLED (level: ${config.level || 'verbose'})`
            );
            console.log(
                '\x1b[33m%s\x1b[0m', // Yellow color
                `${config.prefix || '[NestAuth]'} TIP: If you don't see debug/verbose logs, either:\n` +
                `  1. Set useConsole: true in debug config, OR\n` +
                `  2. Configure NestJS app with: new Logger({ level: 'verbose' })`
            );
        }
    }

    /**
     * Gets the current config by merging defaults with auth module options
     * This is called on each log to ensure we have the latest config
     */
    private getConfig(): DebugLogOptions {
        const authOptions = this.authConfig.getConfig();
        if (authOptions.debug) {
            return {
                ...this.defaultConfig,
                ...authOptions.debug
            };
        }
        return this.defaultConfig;
    }

    private shouldLog(level: DebugLogLevel): boolean {
        const config = this.getConfig();
        if (!config.enabled) return false;

        const levels = [
            DebugLogLevel.ERROR,
            DebugLogLevel.WARN,
            DebugLogLevel.INFO,
            DebugLogLevel.DEBUG,
            DebugLogLevel.VERBOSE
        ];

        const currentLevelIndex = levels.indexOf(config.level || DebugLogLevel.VERBOSE);
        const requestedLevelIndex = levels.indexOf(level);

        return requestedLevelIndex <= currentLevelIndex;
    }

    private formatMessage(message: string, context?: string, data?: any): string {
        const config = this.getConfig();
        let formattedMessage = '';

        if (config.prefix) {
            formattedMessage += `${config.prefix} `;
        }

        if (config.includeTimestamp) {
            formattedMessage += `[${new Date().toISOString()}] `;
        }

        if (config.includeContext && context) {
            formattedMessage += `[${context}] `;
        }

        formattedMessage += message;

        if (data) {
            formattedMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
        }

        return formattedMessage;
    }

    /**
     * Internal logging method that respects useConsole option
     */
    private logWithLevel(level: DebugLogLevel, message: string, trace?: string): void {
        const config = this.getConfig();
        
        if (config.useConsole) {
            // Use console directly to bypass NestJS log level filtering
            const colorCodes: Record<DebugLogLevel, string> = {
                [DebugLogLevel.ERROR]: '\x1b[31m', // Red
                [DebugLogLevel.WARN]: '\x1b[33m',  // Yellow
                [DebugLogLevel.INFO]: '\x1b[32m',  // Green
                [DebugLogLevel.DEBUG]: '\x1b[36m', // Cyan
                [DebugLogLevel.VERBOSE]: '\x1b[35m' // Magenta
            };
            const reset = '\x1b[0m';
            const color = colorCodes[level] || '';
            
            switch (level) {
                case DebugLogLevel.ERROR:
                    console.error(`${color}[ERROR]${reset} ${message}`);
                    if (trace) console.error(trace);
                    break;
                case DebugLogLevel.WARN:
                    console.warn(`${color}[WARN]${reset} ${message}`);
                    break;
                default:
                    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`);
            }
        } else {
            // Use NestJS Logger (respects NestJS log level settings)
            switch (level) {
                case DebugLogLevel.ERROR:
                    this.logger.error(message, trace);
                    break;
                case DebugLogLevel.WARN:
                    this.logger.warn(message);
                    break;
                case DebugLogLevel.INFO:
                    this.logger.log(message);
                    break;
                case DebugLogLevel.DEBUG:
                    this.logger.debug(message);
                    break;
                case DebugLogLevel.VERBOSE:
                    this.logger.verbose(message);
                    break;
            }
        }
    }

    error(message: string, context?: string, data?: any, trace?: string): void {
        if (this.shouldLog(DebugLogLevel.ERROR)) {
            this.logWithLevel(DebugLogLevel.ERROR, this.formatMessage(message, context, data), trace);
        }
    }

    warn(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.WARN)) {
            this.logWithLevel(DebugLogLevel.WARN, this.formatMessage(message, context, data));
        }
    }

    info(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.INFO)) {
            this.logWithLevel(DebugLogLevel.INFO, this.formatMessage(message, context, data));
        }
    }

    debug(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.DEBUG)) {
            this.logWithLevel(DebugLogLevel.DEBUG, this.formatMessage(message, context, data));
        }
    }

    verbose(message: string, context?: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.VERBOSE)) {
            this.logWithLevel(DebugLogLevel.VERBOSE, this.formatMessage(message, context, data));
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
