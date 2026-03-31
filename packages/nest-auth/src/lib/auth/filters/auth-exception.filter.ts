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

        response.status(status).json({
            statusCode: status,
            error,
            message,
            ...(code ? { code } : {}),
        });
    }
}