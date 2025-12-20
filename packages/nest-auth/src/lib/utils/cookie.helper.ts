import { Request, Response } from 'express';

export interface CookieOptions {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number; // in milliseconds
    expires?: Date;
    path?: string;
    domain?: string;
}

export class CookieHelper {
    /**
     * Parse cookies from request headers
     * @param req Express Request object
     * @returns Object containing all cookies
     */
    static parseCookies(req: Request): Record<string, string> {
        const cookieHeader = req.headers.cookie;
        if (!cookieHeader) {
            return {};
        }

        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, ...rest] = cookie.split('=');
            const value = rest.join('=').trim();
            if (name) {
                cookies[name.trim()] = decodeURIComponent(value);
            }
        });

        return cookies;
    }

    /**
     * Get a specific cookie value from request
     * @param req Express Request object
     * @param name Cookie name
     * @returns Cookie value or undefined
     */
    static get(req: Request, name: string): string | undefined {
        const cookies = this.parseCookies(req);
        return cookies[name];
    }

    /**
     * Set a cookie in response
     * @param res Express Response object
     * @param name Cookie name
     * @param value Cookie value
     * @param options Cookie options
     */
    static set(
        res: Response,
        name: string,
        value: string,
        options?: CookieOptions
    ): void {
        const defaultOptions: CookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        };

        const finalOptions = { ...defaultOptions, ...options };
        res.cookie(name, value, finalOptions);
    }

    /**
     * Update a cookie (alias for set)
     * @param res Express Response object
     * @param name Cookie name
     * @param value New cookie value
     * @param options Cookie options
     */
    static update(
        res: Response,
        name: string,
        value: string,
        options?: CookieOptions
    ): void {
        this.set(res, name, value, options);
    }

    /**
     * Delete a cookie by setting its expiration to the past
     * @param res Express Response object
     * @param name Cookie name
     * @param options Additional options (path, domain)
     */
    static delete(
        res: Response,
        name: string,
        options?: Pick<CookieOptions, 'path' | 'domain'>
    ): void {
        const deleteOptions = {
            ...options,
            expires: new Date(0),
            maxAge: 0,
        };
        res.clearCookie(name, deleteOptions);
    }

    /**
     * Check if a cookie exists in request
     * @param req Express Request object
     * @param name Cookie name
     * @returns True if cookie exists
     */
    static exists(req: Request, name: string): boolean {
        return this.get(req, name) !== undefined;
    }

    /**
     * Get all cookies from request
     * @param req Express Request object
     * @returns Object containing all cookies
     */
    static getAll(req: Request): Record<string, string> {
        return this.parseCookies(req);
    }

    /**
     * Set multiple cookies at once
     * @param res Express Response object
     * @param cookies Object with cookie names as keys and values/options as values
     */
    static setMultiple(
        res: Response,
        cookies: Record<string, { value: string; options?: CookieOptions }>
    ): void {
        Object.entries(cookies).forEach(([name, { value, options }]) => {
            this.set(res, name, value, options);
        });
    }

    /**
     * Delete multiple cookies at once
     * @param res Express Response object
     * @param names Array of cookie names to delete
     * @param options Common options for all cookies (path, domain)
     */
    static deleteMultiple(
        res: Response,
        names: string[],
        options?: Pick<CookieOptions, 'path' | 'domain'>
    ): void {
        names.forEach(name => {
            this.delete(res, name, options);
        });
    }
}
