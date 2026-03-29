/**
 * Extract a user-facing message from API/client errors.
 */
export function errorMessage(err: unknown): string {
    if (err == null) {
        return 'Something went wrong';
    }
    if (typeof err === 'string') {
        return err;
    }
    if (typeof err === 'object') {
        const e = err as Record<string, unknown>;
        const msg = e.message;
        if (typeof msg === 'string' && msg) {
            return msg;
        }
        const resp = e.response as Record<string, unknown> | undefined;
        const data = (resp?.data ?? e.data) as Record<string, unknown> | undefined;
        const m = data?.message;
        if (typeof m === 'string' && m) {
            return m;
        }
    }
    return 'Something went wrong';
}
