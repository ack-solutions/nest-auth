import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Exception filter for authentication-related errors
 * 
 * Handles UnauthorizedException and AuthException without logging to console (reduces noise)
 * while still returning proper 401 responses with custom error codes to clients.
 */
@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(AuthExceptionFilter.name);

    catch(exception: UnauthorizedException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();


        // Handle standard UnauthorizedException
        const status = exception.getStatus();
        // Return clean 401 response
        response.status(status).json({
            statusCode: status,
            error: 'Unauthorized',
            message: exception.message,
        });
    }
}
