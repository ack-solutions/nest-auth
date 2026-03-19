import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Search, List } from 'lucide-react';
import Icon from '@mui/material/Icon';
import {
    Box,
    Typography,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Chip,
    Paper,
    Checkbox,
    FormHelperText,
} from '@mui/material';
import { api } from '../services/api';

export interface PermissionInputProps {
    label?: string;
    value: string[];
    onChange: (permissions: string[]) => void;
    placeholder?: string;
    helperText?: string;
    error?: string;
    guard?: string;
    /** When false, only permissions from the API (for the guard) can be added; no custom/free-text permissions. */
    allowCustom?: boolean;
}

interface PermissionSuggestion {
    id: string;
    name: string;
    description?: string;
    category?: string;
}

export const PermissionInput: React.FC<PermissionInputProps> = ({
    label,
    value = [],
    onChange,
    placeholder = 'Type to search or paste multiple (comma/newline separated)...',
    helperText,
    error,
    guard,
    allowCustom = true,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<PermissionSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout>();
    const [listSearchQuery, setListSearchQuery] = useState('');
    const [previewPermissions, setPreviewPermissions] = useState<string[]>([]);
    const [showAllPermissions, setShowAllPermissions] = useState(false);
    const [allPermissions, setAllPermissions] = useState<PermissionSuggestion[]>([]);
    const [loadingAllPermissions, setLoadingAllPermissions] = useState(false);
    const [allPermissionsSearchQuery, setAllPermissionsSearchQuery] = useState('');

    // Fetch permission suggestions from API
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 1) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setIsLoadingSuggestions(true);
        try {
            const params = new URLSearchParams({
                q: query.trim(),
                limit: '8',
            });
            if (guard) {
                params.append('guard', guard);
            }
            const response = await api.get<{ data: PermissionSuggestion[] }>(
                `/api/permissions/search?${params.toString()}`
            );
            const filtered = (response.data || []).filter(
                (suggestion) => !value.includes(suggestion.name)
            );
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0 || query.trim().length > 0);
            setHighlightedIndex(-1);
        } catch (error) {
            console.error('Failed to fetch permission suggestions:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [value, guard]);

    // Fetch all permissions for the guard
    const fetchAllPermissions = useCallback(async () => {
        if (!guard) {
            setAllPermissions([]);
            return;
        }

        setLoadingAllPermissions(true);
        try {
            const params = new URLSearchParams({
                guard,
                limit: '1000', // Get all permissions
            });
            const response = await api.get<{ data: PermissionSuggestion[] }>(
                `/api/permissions?${params.toString()}`
            );
            setAllPermissions(response.data || []);
        } catch (error) {
            console.error('Failed to fetch all permissions:', error);
            setAllPermissions([]);
        } finally {
            setLoadingAllPermissions(false);
        }
    }, [guard]);

    // When allowCustom is false, show "all permissions" list by default so user only picks from API
    useEffect(() => {
        if (!allowCustom && guard) {
            setShowAllPermissions(true);
        }
    }, [allowCustom, guard]);

    // Load all permissions when guard changes and showAllPermissions is true
    useEffect(() => {
        if (showAllPermissions && guard) {
            fetchAllPermissions();
        }
    }, [showAllPermissions, guard, fetchAllPermissions]);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            fetchSuggestions(inputValue);
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [inputValue, fetchSuggestions]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAdd = (perm: string) => {
        const trimmed = perm.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
        }
        setInputValue('');
        setShowSuggestions(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    const parsePermissionsFromInput = (text: string): string[] => {
        // Parse text: split by newlines, commas, tabs, or multiple spaces, then trim and filter
        const permissions = text
            .split(/[,\n\r\t]+| {2,}/) // Split by comma, newline, tab, or multiple spaces
            .map(p => p.trim())
            .filter(p => p && p.length > 0 && !value.includes(p));
        return permissions;
    };

    const handleBulkAdd = (text: string) => {
        const parsed = parsePermissionsFromInput(text);
        const toAdd = allowCustom
            ? parsed
            : parsed.filter((p) => allPermissions.some((ap) => ap.name === p));
        if (toAdd.length > 0) {
            onChange([...value, ...toAdd]);
            setInputValue('');
            setPreviewPermissions([]);
            setShowSuggestions(false);
            setSuggestions([]);
            setHighlightedIndex(-1);
            inputRef.current?.focus();
        }
    };

    const handleAddClick = () => {
        if (previewPermissions.length > 0) {
            // Add all preview permissions
            const newPermissions = previewPermissions.filter(p => !value.includes(p));
            if (newPermissions.length > 0) {
                onChange([...value, ...newPermissions]);
            }
            setInputValue('');
            setPreviewPermissions([]);
            setShowSuggestions(false);
            setSuggestions([]);
            setHighlightedIndex(-1);
            inputRef.current?.focus();
        } else if (inputValue.trim()) {
            // Single permission
            handleAdd(inputValue);
        }
    };

    const handleRemovePreview = (perm: string) => {
        const updated = previewPermissions.filter(p => p !== perm);
        setPreviewPermissions(updated);
        // Reconstruct input value from remaining preview permissions
        setInputValue(updated.join(', '));
    };

    // Update preview permissions when input changes
    useEffect(() => {
        if (inputValue.trim()) {
            const parsed = parsePermissionsFromInput(inputValue);
            setPreviewPermissions(parsed);
        } else {
            setPreviewPermissions([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue]);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData('text');
        // Let the input handle it normally - it will be parsed and shown as preview chips
        // User can then click + to add them all
    };

    const handleSuggestionClick = (suggestion: PermissionSuggestion) => {
        handleAdd(suggestion.name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                handleSuggestionClick(suggestions[highlightedIndex]);
            } else if (showSuggestions && suggestions.length > 0) {
                handleSuggestionClick(suggestions[0]);
            } else if (previewPermissions.length > 0) {
                handleAddClick();
            } else if (inputValue.trim() && allowCustom) {
                // Only allow adding raw text when allowCustom is true
                handleAdd(inputValue);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (showSuggestions && suggestions.length > 0) {
                setHighlightedIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setHighlightedIndex(-1);
        } else if (e.key === ',' && allowCustom) {
            e.preventDefault();
            if (inputValue.trim()) {
                handleAdd(inputValue);
            }
        }
    };

    const handleRemove = (perm: string) => {
        onChange(value.filter((p) => p !== perm));
    };

    const handleTogglePermission = (permName: string) => {
        if (value.includes(permName)) {
            // Remove permission
            onChange(value.filter(p => p !== permName));
        } else {
            // Add permission
            onChange([...value, permName]);
        }
    };

    const getFilteredAllPermissions = () => {
        if (!allPermissionsSearchQuery.trim()) {
            return allPermissions;
        }
        const query = allPermissionsSearchQuery.toLowerCase();
        return allPermissions.filter(perm => 
            perm.name.toLowerCase().includes(query) ||
            perm.description?.toLowerCase().includes(query) ||
            perm.category?.toLowerCase().includes(query)
        );
    };

    const getFilteredPermissions = () => {
        if (!listSearchQuery.trim()) {
            return value;
        }
        const query = listSearchQuery.toLowerCase();
        return value.filter(perm => perm.toLowerCase().includes(query));
    };

    return (
        <Box sx={{ width: '100%' }}>
            {label && (
                <Typography variant="body2" fontWeight="500" color="text.primary" sx={{ display: 'block', mb: 1 }}>
                    {label}
                </Typography>
            )}

            <Box sx={{ position: 'relative' }}>
                <TextField
                    inputRef={inputRef}
                    fullWidth
                    size="small"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        if (e.target.value.trim().length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onFocus={() => {
                        if (inputValue.trim().length > 0) setShowSuggestions(true);
                    }}
                    placeholder={previewPermissions.length === 0 ? placeholder : ''}
                    error={!!error}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start" sx={{ mr: 0 }}>
                                <Icon component={Search} sx={{ fontSize: 16, color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                        endAdornment: previewPermissions.length > 0 ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={handleAddClick} title={`Add ${previewPermissions.length} permission(s)`} color="primary">
                                    <Icon component={Plus} sx={{ fontSize: 20 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : undefined,
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            flexWrap: 'wrap',
                            gap: 1,
                            alignItems: 'center',
                            minHeight: 42,
                            pl: 1.5,
                            pr: 1,
                        },
                        '& .MuiInputBase-input': { py: 1, pl: 0.5 },
                    }}
                />
                {previewPermissions.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {previewPermissions.map((perm) => (
                            <Chip
                                key={perm}
                                size="small"
                                label={perm}
                                onDelete={() => handleRemovePreview(perm)}
                                deleteIcon={<Icon component={X} sx={{ fontSize: 12 }} />}
                                sx={{ fontFamily: 'monospace' }}
                            />
                        ))}
                    </Box>
                )}

                {showSuggestions && (inputValue.trim().length > 0 || suggestions.length > 0) && (
                    <Paper ref={suggestionsRef} elevation={4} sx={{ position: 'absolute', zIndex: 50, width: '100%', mt: 0.5, maxHeight: 240, overflow: 'auto' }}>
                        {isLoadingSuggestions ? (
                            <Box sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Searching...</Typography>
                            </Box>
                        ) : suggestions.length > 0 ? (
                            suggestions.map((suggestion, index) => (
                                <Box
                                    key={suggestion.id}
                                    component="button"
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    sx={{
                                        width: '100%',
                                        textAlign: 'left',
                                        p: 1.25,
                                        border: 'none',
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: highlightedIndex === index ? 'action.hover' : 'transparent',
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'action.hover' },
                                        '&:last-of-type': { borderBottom: 0 },
                                    }}
                                >
                                    <Typography variant="body2" fontWeight="500">{suggestion.name}</Typography>
                                    {suggestion.description && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {suggestion.description}
                                        </Typography>
                                    )}
                                    {suggestion.category && (
                                        <Chip size="small" label={suggestion.category} sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} color="primary" variant="outlined" />
                                    )}
                                </Box>
                            ))
                        ) : inputValue.trim() ? (
                            <Box sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    {allowCustom
                                        ? `Press Enter or click + to add "${inputValue.trim()}"`
                                        : 'No match. Select from the list below or refine your search.'}
                                </Typography>
                            </Box>
                        ) : null}
                    </Paper>
                )}
            </Box>

            {guard && (
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                            setShowAllPermissions(!showAllPermissions);
                            if (!showAllPermissions && allPermissions.length === 0) fetchAllPermissions();
                        }}
                        startIcon={showAllPermissions ? <Icon component={Search} /> : <Icon component={List} />}
                        sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                        {showAllPermissions ? 'Search Mode' : 'Show All Permissions'}
                    </Button>
                    {value.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {value.length} permission{value.length !== 1 ? 's' : ''} selected
                        </Typography>
                    )}
                </Box>
            )}

            {showAllPermissions && guard && (
                <Paper variant="outlined" sx={{ mt: 1.5, overflow: 'hidden' }}>
                    <Box sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" fontWeight="500">All Permissions ({allPermissions.length})</Typography>
                            {value.length > 0 && (
                                <Typography component="button" type="button" onClick={() => onChange([])} variant="caption" sx={{ color: 'error.main', border: 0, background: 'none', cursor: 'pointer' }}>
                                    Clear All
                                </Typography>
                            )}
                        </Box>
                        <TextField
                            size="small"
                            placeholder="Search permissions..."
                            value={allPermissionsSearchQuery}
                            onChange={(e) => setAllPermissionsSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start"><Icon component={Search} sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment>
                                ),
                            }}
                            sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' }, width: '100%' }}
                        />
                        <Box sx={{ mt: 1 }}>
                            <Typography
                                component="button"
                                type="button"
                                variant="caption"
                                onClick={() => {
                                    const filtered = getFilteredAllPermissions();
                                    const allSelected = filtered.every(p => value.includes(p.name));
                                    if (allSelected) {
                                        onChange(value.filter(p => !filtered.some(fp => fp.name === p)));
                                    } else {
                                        const toAdd = filtered.filter(p => !value.includes(p.name)).map(p => p.name);
                                        onChange([...value, ...toAdd]);
                                    }
                                }}
                                sx={{ color: 'primary.main', border: 0, background: 'none', cursor: 'pointer' }}
                            >
                                {getFilteredAllPermissions().every(p => value.includes(p.name)) ? 'Deselect All' : 'Select All'}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {loadingAllPermissions ? (
                            <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" color="text.secondary">Loading permissions...</Typography></Box>
                        ) : getFilteredAllPermissions().length > 0 ? (
                            getFilteredAllPermissions().map((perm) => (
                                <Box
                                    key={perm.id}
                                    sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'flex-start', gap: 1.5, '&:hover': { bgcolor: 'action.hover' }, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
                                >
                                    <Checkbox size="small" checked={value.includes(perm.name)} onChange={() => handleTogglePermission(perm.name)} sx={{ mt: 0.25, p: 0.5 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                            <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-word' }}>{perm.name}</Typography>
                                            {perm.category && <Chip size="small" label={perm.category} sx={{ height: 20, fontSize: '0.7rem' }} color="primary" variant="outlined" />}
                                        </Box>
                                        {perm.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perm.description}</Typography>}
                                    </Box>
                                </Box>
                            ))
                        ) : (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    {allPermissionsSearchQuery ? `No permissions match "${allPermissionsSearchQuery}"` : `No permissions found for guard "${guard}"`}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Paper>
            )}

            {!showAllPermissions && value.length > 0 && (
                <Paper variant="outlined" sx={{ mt: 1.5, overflow: 'hidden' }}>
                    <Box sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="body2" fontWeight="500">{value.length} permission{value.length !== 1 ? 's' : ''} added</Typography>
                        <TextField
                            size="small"
                            placeholder="Search permissions..."
                            value={listSearchQuery}
                            onChange={(e) => setListSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Icon component={Search} sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment>,
                            }}
                            sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' }, width: '100%', mt: 1 }}
                        />
                    </Box>
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {getFilteredPermissions().length > 0 ? (
                            getFilteredPermissions().map((perm) => (
                                <Box key={perm} sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                                    <Checkbox size="small" checked={value.includes(perm)} onChange={() => handleTogglePermission(perm)} title={value.includes(perm) ? 'Uncheck to remove' : 'Check to add'} />
                                    <Typography variant="body2" fontFamily="monospace" sx={{ flex: 1, wordBreak: 'break-word' }}>{perm}</Typography>
                                    <IconButton size="small" onClick={() => handleRemove(perm)} title="Remove permission" sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}><Icon component={X} sx={{ fontSize: 16 }} /></IconButton>
                                </Box>
                            ))
                        ) : (
                            <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="caption" color="text.secondary">No permissions match &quot;{listSearchQuery}&quot;</Typography></Box>
                        )}
                    </Box>
                </Paper>
            )}

            {helperText && !error && <FormHelperText sx={{ mt: 0.5 }}>{helperText}</FormHelperText>}
            {error && <FormHelperText error sx={{ mt: 0.5 }}>{error}</FormHelperText>}
        </Box>
    );
};
