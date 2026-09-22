import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class AuthExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(AuthExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        const rawMessage =
            typeof exceptionResponse === 'string'
                ? exceptionResponse
                : (exceptionResponse as any)?.message ?? exception.message;

        const message = Array.isArray(rawMessage)
            ? rawMessage[0]
            : rawMessage;

        const code =
            typeof exceptionResponse === 'string'
                ? undefined
                : (exceptionResponse as any)?.code;

        const error =
            typeof exceptionResponse === 'string'
                ? exception.name
                : (exceptionResponse as any)?.error ?? exception.name;

        // Forward any structured keys the handler attached (`errors`, `problems`,
        // per-row import failures, …). Nest's default body would have carried
        // them; normalizing the envelope must not strip them. The normalized
        // keys below still win, so `message` stays a SINGLE string (clients
        // parse it) and `statusCode`/`error`/`code` keep their shape.
        const extras: Record<string, unknown> = {};
        if (exceptionResponse && typeof exceptionResponse === 'object') {
            for (const [key, value] of Object.entries(exceptionResponse)) {
                if (key === 'statusCode' || key === 'error' || key === 'message' || key === 'code') continue;
                extras[key] = value;
            }
        }

        response.status(status).json({
            ...extras,
            statusCode: status,
            error,
            message,
            ...(code ? { code } : {}),
        });
    }
}