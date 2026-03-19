import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import { api } from '../../services/api';

export interface PermissionItem {
    id: string;
    name: string;
    description?: string;
    category?: string;
}

export interface RolePermissionChecklistProps {
    guard: string;
    value: string[];
    onChange: (permissions: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

function groupByCategory(permissions: PermissionItem[]): Map<string, PermissionItem[]> {
    const map = new Map<string, PermissionItem[]>();
    for (const p of permissions) {
        const cat = p.category?.trim() || 'General';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(p);
    }
    // Sort categories: General last, rest alphabetical
    const sorted = new Map<string, PermissionItem[]>();
    const keys = Array.from(map.keys()).sort((a, b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
    });
    keys.forEach((k) => sorted.set(k, map.get(k)!));
    return sorted;
}

export const RolePermissionChecklist: React.FC<RolePermissionChecklistProps> = ({
    guard,
    value,
    onChange,
    disabled = false,
    placeholder = 'Search permissions...',
}) => {
    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const fetchPermissions = useCallback(async () => {
        if (!guard) {
            setPermissions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ guard, limit: '1000' });
            const res = await api.get<{ data: PermissionItem[] }>(`/api/permissions?${params.toString()}`);
            setPermissions(res.data ?? []);
            const grouped = groupByCategory(res.data ?? []);
            setExpandedCategories(new Set(grouped.keys()));
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load permissions');
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    }, [guard]);

    useEffect(() => {
        if (guard) fetchPermissions();
    }, [guard, fetchPermissions]);

    const grouped = useMemo(() => groupByCategory(permissions), [permissions]);

    const filteredGrouped = useMemo(() => {
        if (!searchQuery.trim()) return grouped;
        const q = searchQuery.toLowerCase();
        const filtered = new Map<string, PermissionItem[]>();
        grouped.forEach((items, cat) => {
            const matching = items.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q) ||
                    (p.category && p.category.toLowerCase().includes(q)),
            );
            if (matching.length) filtered.set(cat, matching);
        });
        return filtered;
    }, [grouped, searchQuery]);

    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    };

    const togglePermission = (name: string) => {
        if (disabled) return;
        if (value.includes(name)) {
            onChange(value.filter((p) => p !== name));
        } else {
            onChange([...value, name]);
        }
    };

    const selectAllInCategory = (category: string) => {
        if (disabled) return;
        const items = filteredGrouped.get(category) ?? [];
        const names = items.map((p) => p.name);
        const allSelected = names.every((n) => value.includes(n));
        if (allSelected) {
            onChange(value.filter((p) => !names.includes(p)));
        } else {
            const toAdd = names.filter((n) => !value.includes(n));
            onChange([...value, ...toAdd]);
        }
    };

    const selectAll = () => {
        if (disabled) return;
        const allNames = Array.from(filteredGrouped.values()).flat().map((p) => p.name);
        const allSelected = allNames.every((n) => value.includes(n));
        if (allSelected) onChange([]);
        else onChange([...new Set([...value, ...allNames])]);
    };

    const selectedCount = value.length;
    const totalCount = permissions.length;
    const filteredNames = useMemo(
        () => Array.from(filteredGrouped.values()).flat().map((p) => p.name),
        [filteredGrouped],
    );
    const filteredCount = filteredNames.length;
    const allFilteredSelected = filteredCount > 0 && filteredNames.every((n) => value.includes(n));

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                <TextField
                    size="small"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={disabled || loading}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Icon component={Search} sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: 220, flex: 1, maxWidth: 360 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {selectedCount} of {searchQuery.trim() ? filteredCount : totalCount} selected
                    </Typography>
                    <Typography
                        component="button"
                        type="button"
                        variant="caption"
                        onClick={selectAll}
                        sx={{ color: 'primary.main', border: 0, background: 'none', cursor: disabled ? 'default' : 'pointer', fontWeight: 600 }}
                    >
                        {allFilteredSelected ? 'Deselect all' : 'Select all'}
                    </Typography>
                </Box>
            </Box>

            {error && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'error.50', borderColor: 'error.200' }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                </Paper>
            )}

            {loading ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Loading permissions...</Typography>
                </Box>
            ) : filteredGrouped.size === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        {searchQuery.trim()
                            ? `No permissions match "${searchQuery}"`
                            : `No permissions found for guard "${guard}". Create permissions first.`}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Array.from(filteredGrouped.entries()).map(([category, items]) => {
                        const isExpanded = expandedCategories.has(category);
                        const selectedInCategory = items.filter((p) => value.includes(p.name)).length;
                        const allInCategorySelected = items.length > 0 && selectedInCategory === items.length;

                        return (
                            <Paper key={category} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={() => toggleCategory(category)}
                                    sx={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1.25,
                                        border: 'none',
                                        bgcolor: 'grey.50',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        '&:hover': { bgcolor: 'grey.100' },
                                    }}
                                >
                                    <IconButton size="small" sx={{ p: 0.25 }}>
                                        {isExpanded ? <Icon component={ChevronDown} sx={{ fontSize: 18 }} /> : <Icon component={ChevronRight} sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                    <Typography variant="subtitle2" fontWeight={600} color="text.primary" sx={{ flex: 1 }}>
                                        {category}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {selectedInCategory}/{items.length}
                                    </Typography>
                                    <Checkbox
                                        size="small"
                                        checked={allInCategorySelected}
                                        indeterminate={selectedInCategory > 0 && !allInCategorySelected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            selectAllInCategory(category);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        disabled={disabled}
                                        icon={<Icon component={Square} sx={{ fontSize: 18 }} />}
                                        checkedIcon={<Icon component={CheckSquare} sx={{ fontSize: 18 }} />}
                                    />
                                </Box>
                                <Collapse in={isExpanded}>
                                    <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                                        {items.map((perm) => (
                                            <Box
                                                key={perm.id}
                                                onClick={() => togglePermission(perm.name)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 1.5,
                                                    px: 2,
                                                    py: 1.25,
                                                    borderBottom: '1px solid',
                                                    borderColor: 'divider',
                                                    cursor: disabled ? 'default' : 'pointer',
                                                    '&:hover': disabled ? undefined : { bgcolor: 'action.hover' },
                                                    '&:last-of-type': { borderBottom: 0 },
                                                }}
                                            >
                                                <Checkbox
                                                    size="small"
                                                    checked={value.includes(perm.name)}
                                                    onChange={() => togglePermission(perm.name)}
                                                    disabled={disabled}
                                                    sx={{ mt: 0.25, p: 0.5 }}
                                                />
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontFamily="monospace" fontWeight={500} sx={{ wordBreak: 'break-word' }}>
                                                        {perm.name}
                                                    </Typography>
                                                    {perm.description && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                                            {perm.description}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                </Collapse>
                            </Paper>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};
