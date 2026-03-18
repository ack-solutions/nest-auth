import React from 'react';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import TablePagination from '@mui/material/TablePagination';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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
        if (sortable && onSort) onSort(key);
    };

    if (loading) {
        return (
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <CircularProgress size={40} />
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
                        Loading...
                    </Typography>
                </Box>
            </Paper>
        );
    }

    if (data.length === 0) {
        return (
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    {emptyIcon && <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>{emptyIcon}</Box>}
                    <Typography color="text.secondary" fontWeight="medium" variant="body2">
                        {emptyMessage}
                    </Typography>
                </Box>
            </Paper>
        );
    }

    const page = pagination?.page ?? 1;
    const totalPages = pagination?.totalPages ?? 0;
    const total = pagination?.total ?? 0;
    const limit = pagination?.limit ?? 10;

    return (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <TableContainer>
                <MuiTable size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.key}
                                    onClick={() => handleSort(column.key, column.sortable)}
                                    sx={{
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                        color: 'text.secondary',
                                        cursor: column.sortable ? 'pointer' : 'default',
                                        '&:hover': column.sortable ? { bgcolor: 'action.hover' } : undefined,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {column.label}
                                        {column.sortable && sortBy === column.key && (
                                            <Typography component="span" color="primary.main" fontSize="0.75rem">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.map((row) => (
                            <TableRow
                                key={rowKey(row)}
                                hover
                                onClick={() => onRowClick?.(row)}
                                sx={{
                                    cursor: onRowClick ? 'pointer' : 'default',
                                }}
                            >
                                {columns.map((column) => (
                                    <TableCell key={column.key} sx={{ py: 1.5 }}>
                                        {column.render ? column.render(row) : String((row as any)[column.key] ?? '')}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </MuiTable>
            </TableContainer>
            {pagination && onPageChange && totalPages > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        borderTop: 1,
                        borderColor: 'divider',
                        bgcolor: 'grey.50',
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        Showing{' '}
                        <Typography component="span" fontWeight="600">
                            {Math.min((page - 1) * limit + 1, total)}
                        </Typography>{' '}
                        to{' '}
                        <Typography component="span" fontWeight="600">
                            {Math.min(page * limit, total)}
                        </Typography>{' '}
                        of <Typography component="span" fontWeight="600">{total}</Typography> results
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                            aria-label="Previous page"
                        >
                            <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="caption" sx={{ px: 1 }}>
                            Page {page} of {totalPages}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            aria-label="Next page"
                        >
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
            )}
        </Paper>
    );
}
