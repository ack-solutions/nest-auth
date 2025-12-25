/**
 * Cross-tab synchronization for auth state
 */

const CHANNEL_NAME = 'nest-auth-sync';
const STORAGE_KEY = 'nest_auth_sync_event';

/**
 * Sync event types
 */
export type SyncEventType = 'logout' | 'login' | 'refresh';

/**
 * Sync event data
 */
export interface SyncEvent {
    type: SyncEventType;
    timestamp: number;
}

/**
 * Cross-tab sync handler type
 */
export type SyncHandler = (event: SyncEvent) => void;

/**
 * Cross-tab synchronization manager
 * 
 * Uses BroadcastChannel where available, with localStorage fallback.
 * Automatically syncs logout/login events across browser tabs.
 */
export class CrossTabSync {
    private channel: BroadcastChannel | null = null;
    private handlers: Set<SyncHandler> = new Set();
    private lastEventTime = 0;
    private storageListener: ((e: StorageEvent) => void) | null = null;

    constructor() {
        if (typeof window === 'undefined') return;

        // Try BroadcastChannel first
        if (typeof BroadcastChannel !== 'undefined') {
            this.initBroadcastChannel();
        } else {
            // Fallback to localStorage events
            this.initStorageFallback();
        }
    }

    private initBroadcastChannel(): void {
        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);
            this.channel.onmessage = (event) => {
                if (event.data && this.isValidEvent(event.data)) {
                    this.notifyHandlers(event.data);
                }
            };
        } catch {
            // BroadcastChannel failed, use fallback
            this.initStorageFallback();
        }
    }

    private initStorageFallback(): void {
        this.storageListener = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY && event.newValue) {
                try {
                    const syncEvent = JSON.parse(event.newValue);
                    if (this.isValidEvent(syncEvent)) {
                        this.notifyHandlers(syncEvent);
                    }
                } catch {
                    // Invalid JSON
                }
            }
        };

        window.addEventListener('storage', this.storageListener);
    }

    private isValidEvent(data: any): data is SyncEvent {
        return (
            data &&
            typeof data.type === 'string' &&
            typeof data.timestamp === 'number' &&
            data.timestamp > this.lastEventTime
        );
    }

    private notifyHandlers(event: SyncEvent): void {
        this.lastEventTime = event.timestamp;
        this.handlers.forEach(handler => {
            try {
                handler(event);
            } catch {
                // Ignore handler errors
            }
        });
    }

    /**
     * Subscribe to sync events
     * @returns Unsubscribe function
     */
    subscribe(handler: SyncHandler): () => void {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    /**
     * Broadcast an event to other tabs
     */
    broadcast(type: SyncEventType): void {
        const event: SyncEvent = {
            type,
            timestamp: Date.now(),
        };

        if (this.channel) {
            this.channel.postMessage(event);
        } else if (typeof window !== 'undefined' && window.localStorage) {
            // Use localStorage for fallback
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
                // Remove immediately - we only need to trigger the event
                localStorage.removeItem(STORAGE_KEY);
            } catch {
                // localStorage not available
            }
        }
    }

    /**
     * Broadcast logout event
     */
    broadcastLogout(): void {
        this.broadcast('logout');
    }

    /**
     * Broadcast login event
     */
    broadcastLogin(): void {
        this.broadcast('login');
    }

    /**
     * Broadcast token refresh event
     */
    broadcastRefresh(): void {
        this.broadcast('refresh');
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }
        this.handlers.clear();
    }
}

/**
 * Create a cross-tab sync instance
 */
export function createCrossTabSync(): CrossTabSync {
    return new CrossTabSync();
}
