/**
 * Simple event emitter for auth events
 */

import { ISessionUserData } from "@ackplus/nest-auth-contracts";

type EventCallback<T = any> = (data: T) => void;

/**
 * Lightweight event emitter for authentication events
 */
export class EventEmitter<Events extends Record<string, any> = Record<string, any>> {
    private listeners = new Map<keyof Events, Set<EventCallback>>();

    /**
     * Subscribe to an event
     * @returns Unsubscribe function
     */
    on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.off(event, callback);
        };
    }

    /**
     * Subscribe to an event, but only fire once
     */
    once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
        const wrapper: EventCallback<Events[K]> = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     */
    off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Emit an event
     */
    emit<K extends keyof Events>(event: K, data: Events[K]): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${String(event)}:`, error);
            }
        });
    }

    /**
     * Emit an event and wait for all async listeners to complete
     */
    async emitAsync<K extends keyof Events>(event: K, data: Events[K]): Promise<void> {
        const listeners = this.listeners.get(event);
        if (!listeners || listeners.size === 0) {
            return;
        }

        const promises = Array.from(listeners).map(callback => {
            try {
                const result = callback(data);
                // Wrap result in Promise.resolve() to handle both void and Promise returns
                return Promise.resolve(result);
            } catch (error) {
                console.error(`Error in event listener for ${String(event)}:`, error);
                return Promise.resolve();
            }
        });

        await Promise.all(promises);
    }

    /**
     * Remove all listeners for an event, or all listeners if no event specified
     */
    removeAllListeners<K extends keyof Events>(event?: K): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

/**
 * Auth event types
 */
export interface AuthEvents {
    /** Tokens were refreshed */
    tokenRefreshed: { accessToken: string; refreshToken: string };
    /** Tokens were set (login, signup, refresh, etc.) */
    tokensSet: { accessToken: string; refreshToken: string; trustToken?: string };
    /** Tokens were removed (logout, etc.) */
    tokensRemoved: void;
    /** User logged out */
    logout: void;
    /** An error occurred */
    error: { message: string; code?: string; statusCode?: number; kind?: 'rejected' | 'indeterminate' };

    /** Session data was refreshed */
    sessionVerified: void;
    refreshSessionData: void;
}

/**
 * Create a pre-typed event emitter for auth events
 */
export function createAuthEventEmitter(): EventEmitter<AuthEvents> {
    return new EventEmitter<AuthEvents>();
}
