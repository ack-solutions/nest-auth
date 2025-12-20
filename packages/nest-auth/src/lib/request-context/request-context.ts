import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response } from 'express';
import { JWTTokenPayload, SessionPayload } from '../core/interfaces/token-payload.interface';

export class RequestContext {

    private static storage = new AsyncLocalStorage<RequestContext>();

    readonly id: number;

    request: Request;

    response: Response;

    private constructor(request: Request, response: Response) {
        this.id = Math.random();
        this.request = request;
        this.response = response;
    }

    public static create(
        request: Request,
        response: Response,
        next: () => void,
    ) {
        const context = new RequestContext(request, response);
        RequestContext.storage.run(context, () => next());
    }

    public static current(): RequestContext | undefined {
        return RequestContext.storage.getStore();
    }

    public static currentRequest(): Request | null {
        const requestContext = RequestContext.current();
        return requestContext ? requestContext.request : null;
    }

    public static currentUser(): JWTTokenPayload | null {
        const request = RequestContext.currentRequest();
        if (!request['user']) {
            return null;
        }
        return {
            id: request['user'].sub,
            ...request['user']
        } as JWTTokenPayload;
    }

    public static currentSession(): SessionPayload | null {
        const request = RequestContext.currentRequest();
        return request ? request['session'] : null;
    }

    public static getDeviceInfo(): { deviceName: string; ipAddress: string; browser: string } {
        return {
            deviceName: this.getDeviceName(),
            ipAddress: this.getIpAddress(),
            browser: this.getBrowser(),
        };
    }

    private static getDeviceName(): string {
        const request = this.currentRequest();
        if (!request) {
            return 'Unknown Device';
        }
        const userAgent = request.headers['user-agent'] || 'unknown';
        if (userAgent.includes('Windows')) {
            return 'Windows';
        } else if (userAgent.includes('Macintosh')) {
            return 'Mac';
        } else if (userAgent.includes('Linux')) {
            return 'Linux';
        } else if (userAgent.includes('Android')) {
            return 'Android';
        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            return 'iOS';
        }
        return 'Unknown Device';
    }

    private static getBrowser(): string {
        const request = this.currentRequest();
        if (!request) {
            return 'unknown';
        }
        const userAgent = request.headers['user-agent'] || 'unknown';

        // Chrome
        if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
            return 'Chrome';
        }
        // Firefox
        if (userAgent.includes('Firefox')) {
            return 'Firefox';
        }
        // Safari
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            return 'Safari';
        }
        // Edge
        if (userAgent.includes('Edg')) {
            return 'Edge';
        }
        // Opera
        if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
            return 'Opera';
        }
        // Internet Explorer
        if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
            return 'Internet Explorer';
        }
        // Brave
        if (userAgent.includes('Brave')) {
            return 'Brave';
        }

        return 'Unknown Browser';
    }

    private static getIpAddress(): string {
        const request = this.currentRequest();
        if (request) {
            return request.ip ||
                request.headers['x-forwarded-for']?.toString() ||
                request.connection.remoteAddress ||
                'unknown';
        }
        return 'unknown';
    }
}
