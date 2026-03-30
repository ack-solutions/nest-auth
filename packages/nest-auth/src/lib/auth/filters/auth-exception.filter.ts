import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Exception filter for authentication-related errors
 * 
 * Handles UnauthorizedException and AuthException without logging to console (reduces noise)
 * while still returning proper 401 responses with custom error codes to clients.
 */
@Catch(HttpException)
export class AuthExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(AuthExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status = exception.getStatus();

        const exceptionResponse = exception.getResponse();
        // Nest can provide either a string message or an object payload.
        const message =
            typeof exceptionResponse === 'string'
                ? exceptionResponse
                : (exceptionResponse as any)?.message ?? exception.message;

        const code = typeof exceptionResponse === 'string' ? undefined : (exceptionResponse as any)?.code;
        const error =
            typeof exceptionResponse === 'string'
                ? 'Error'
                : (exceptionResponse as any)?.error ?? exception.name;

        response.status(status).json({
            statusCode: status,
            error,
            message,
            ...(code ? { code } : {}),
        });
    }
}
