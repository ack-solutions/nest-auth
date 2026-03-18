import { useState, useCallback, useRef } from 'react';

interface UsePaginationOptions {
    initialPage?: number;
    initialLimit?: number;
}

interface UsePaginationResult {
    page: number;
    limit: number;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    reset: () => void;
}

export function usePagination({
    initialPage = 1,
    initialLimit = 10,
}: UsePaginationOptions = {}): UsePaginationResult {
    const [page, setPageState] = useState(initialPage);
    const [limit, setLimitState] = useState(initialLimit);

    // Capture mount-time values
    const mountInitialPageRef = useRef(initialPage);
    const mountInitialLimitRef = useRef(initialLimit);

    const setPage = useCallback((newPage: number) => {
        if (Number.isInteger(newPage) && newPage >= 1) {
            setPageState(newPage);
        } else {
            // eslint-disable-next-line no-console
            console.warn('usePagination.setPage received invalid page:', newPage, '(page must be an integer >= 1)');
        }
    }, []);

    const setLimit = useCallback((newLimit: number) => {
        if (Number.isInteger(newLimit) && newLimit > 0) {
            setLimitState(newLimit);
        } else {
            // eslint-disable-next-line no-console
            console.warn('usePagination.setLimit received invalid limit:', newLimit, '(limit must be a positive integer)');
        }
    }, []);

    const nextPage = useCallback(() => {
        setPageState((prev) => prev + 1);
    }, []);

    const prevPage = useCallback(() => {
        setPageState((prev) => Math.max(1, prev - 1));
    }, []);

    const reset = useCallback(() => {
        setPageState(mountInitialPageRef.current);
        setLimitState(mountInitialLimitRef.current);
    }, []);

    return {
        page,
        limit,
        setPage,
        setLimit,
        nextPage,
        prevPage,
        reset,
    };
}
