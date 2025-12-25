/**
 * Refresh queue to prevent multiple parallel refresh calls
 */

/**
 * Refresh queue for handling concurrent refresh requests
 * 
 * When multiple requests get 401 responses simultaneously,
 * this ensures only one refresh call is made and all requests
 * wait for that single refresh to complete.
 */
export class RefreshQueue {
    private refreshPromise: Promise<any> | null = null;
    private pendingRequests: Array<{
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = [];

    /**
     * Check if a refresh is currently in progress
     */
    isRefreshing(): boolean {
        return this.refreshPromise !== null;
    }

    /**
     * Execute a refresh operation, or wait for an existing one
     * 
     * @param refreshFn - The async function that performs the token refresh
     * @returns The result of the refresh operation
     */
    async refresh<T>(refreshFn: () => Promise<T>): Promise<T> {
        // If a refresh is already in progress, wait for it
        if (this.refreshPromise) {
            return new Promise((resolve, reject) => {
                this.pendingRequests.push({ resolve, reject });
            });
        }

        // Start a new refresh
        this.refreshPromise = refreshFn();

        try {
            const result = await this.refreshPromise;

            // Resolve all pending requests
            this.pendingRequests.forEach(({ resolve }) => resolve(result));
            this.pendingRequests = [];

            return result;
        } catch (error) {
            // Reject all pending requests
            this.pendingRequests.forEach(({ reject }) => reject(error));
            this.pendingRequests = [];

            throw error;
        } finally {
            this.refreshPromise = null;
        }
    }

    /**
     * Cancel any pending refresh
     */
    cancel(): void {
        if (this.refreshPromise) {
            const error = new Error('Refresh cancelled');
            this.pendingRequests.forEach(({ reject }) => reject(error));
            this.pendingRequests = [];
            this.refreshPromise = null;
        }
    }
}

/**
 * Request retry tracker
 * Ensures each request is only retried once after a 401
 */
export class RetryTracker {
    private retriedRequests = new Set<string>();

    /**
     * Generate a unique key for a request
     */
    private getKey(method: string, url: string): string {
        return `${method}:${url}:${Date.now()}`;
    }

    /**
     * Create a new request ID for tracking
     */
    createRequestId(method: string, url: string): string {
        return this.getKey(method, url);
    }

    /**
     * Check if a request has already been retried
     */
    hasRetried(requestId: string): boolean {
        return this.retriedRequests.has(requestId);
    }

    /**
     * Mark a request as retried
     */
    markRetried(requestId: string): void {
        this.retriedRequests.add(requestId);

        // Clean up after a short delay to prevent memory leaks
        setTimeout(() => {
            this.retriedRequests.delete(requestId);
        }, 60000); // 1 minute
    }

    /**
     * Clear all tracked requests
     */
    clear(): void {
        this.retriedRequests.clear();
    }
}
