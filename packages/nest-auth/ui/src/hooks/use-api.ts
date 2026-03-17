import { useState, useCallback, useRef, useEffect } from 'react';

interface UseApiOptions<T> {
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

interface UseApiResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    execute: (...args: any[]) => Promise<T>;
    reset: () => void;
}

export function useApi<T>(
    apiFunction: (...args: any[]) => Promise<T>,
    options: UseApiOptions<T> = {}
): UseApiResult<T> {
    const [data, setData] = useState<T | null>(options.initialData ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { onSuccess, onError } = options;
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    }, [onSuccess, onError]);

    const execute = useCallback(
        async (...args: any[]) => {
            try {
                setLoading(true);
                setError(null);
                const result = await apiFunction(...args);
                setData(result);
                if (onSuccessRef.current) {
                    onSuccessRef.current(result);
                }
                return result;
            } catch (err: any) {
                const errorMessage = err.message || 'An error occurred';
                setError(errorMessage);
                if (onErrorRef.current) {
                    onErrorRef.current(err);
                }
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [apiFunction]
    );

    // Capture mount-time initialData so reset restores the original value
    const initialDataRef = useRef<T | null>(options.initialData ?? null);

    const reset = useCallback(() => {
        setData(initialDataRef.current);
        setError(null);
        setLoading(false);
    }, []);

    return { data, loading, error, execute, reset };
}
