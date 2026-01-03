import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    sortable?: boolean;
}

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    pagination?: PaginationInfo;
    onPageChange?: (page: number) => void;
    onSort?: (key: string) => void;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    rowKey: (row: T) => string | number;
    onRowClick?: (row: T) => void;
}

export function Table<T>({
    columns,
    data,
    loading = false,
    emptyMessage = 'No data found',
    emptyIcon,
    pagination,
    onPageChange,
    onSort,
    sortBy,
    sortOrder,
    rowKey,
    onRowClick,
}: TableProps<T>) {
    const handleSort = (key: string, sortable?: boolean) => {
        if (sortable && onSort) {
            onSort(key);
        }
    };

    const renderPagination = () => {
        if (!pagination || !onPageChange) return null;

        const { page, totalPages, total } = pagination;
        const pages: number[] = [];
        const maxVisible = 5;

        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-700">
                    Showing <span className="font-medium">{Math.min((page - 1) * pagination.limit + 1, total)}</span> to{' '}
                    <span className="font-medium">{Math.min(page * pagination.limit, total)}</span> of{' '}
                    <span className="font-medium">{total}</span> results
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1">
                        {startPage > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onPageChange(1)}
                                    className="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-xs"
                                >
                                    1
                                </button>
                                {startPage > 2 && <span className="px-1.5 text-gray-400 text-xs">...</span>}
                            </>
                        )}

                        {pages.map((p) => (
                            <button
                                type="button"
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={`px-2.5 py-1 rounded-lg border transition-colors text-xs ${p === page
                                    ? 'bg-primary-600 text-white border-primary-600'
                                    : 'border-gray-300 hover:bg-gray-100'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}

                        {endPage < totalPages && (
                            <>
                                {endPage < totalPages - 1 && <span className="px-1.5 text-gray-400 text-xs">...</span>}
                                <button
                                    type="button"
                                    onClick={() => onPageChange(totalPages)}
                                    className="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors text-xs"
                                >
                                    {totalPages}
                                </button>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="card overflow-hidden p-0">
                <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-gray-600 mt-3 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="card overflow-hidden p-0">
                <div className="p-6 text-center">
                    {emptyIcon && <div className="mb-3 flex justify-center">{emptyIcon}</div>}
                    <p className="text-gray-600 font-medium text-sm">{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                                        }`}
                                    onClick={() => handleSort(column.key, column.sortable)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {column.label}
                                        {column.sortable && sortBy === column.key && (
                                            <span className="text-primary-600 text-xs">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((row) => (
                            <tr 
                                key={rowKey(row)} 
                                className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={() => onRowClick?.(row)}
                            >
                                {columns.map((column) => (
                                    <td key={column.key} className="px-3 py-2.5">
                                        {column.render ? column.render(row) : String(row[column.key as keyof T] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {renderPagination()}
        </div>
    );
}
