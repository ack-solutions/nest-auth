/**
 * Simple event emitter for auth events
 */

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
    /** User authentication state changed */
    authStateChange: { user: any | null };
    /** Tokens were refreshed */
    tokenRefreshed: { accessToken: string; refreshToken: string };
    /** User logged out */
    logout: void;
    /** An error occurred */
    error: { message: string; code?: string; statusCode?: number };
}

/**
 * Create a pre-typed event emitter for auth events
 */
export function createAuthEventEmitter(): EventEmitter<AuthEvents> {
    return new EventEmitter<AuthEvents>();
}
