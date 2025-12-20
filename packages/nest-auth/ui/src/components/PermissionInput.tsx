import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Search, Trash2 } from 'lucide-react';
import { api } from '../services/api';

export interface PermissionInputProps {
    label?: string;
    value: string[];
    onChange: (permissions: string[]) => void;
    placeholder?: string;
    helperText?: string;
    error?: string;
    guard?: string;
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
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
    const [previewPermissions, setPreviewPermissions] = useState<string[]>([]);

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
        const permissions = parsePermissionsFromInput(text);
        if (permissions.length > 0) {
            onChange([...value, ...permissions]);
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
                // Add all preview permissions
                handleAddClick();
            } else if (inputValue.trim()) {
                // Single permission
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
        } else if (e.key === ',') {
            e.preventDefault();
            if (inputValue.trim()) {
                handleAdd(inputValue);
            }
        }
    };

    const handleRemove = (perm: string) => {
        onChange(value.filter((p) => p !== perm));
    };

    const handleToggleSelect = (perm: string) => {
        setSelectedPermissions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(perm)) {
                newSet.delete(perm);
            } else {
                newSet.add(perm);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const filteredPerms = getFilteredPermissions();
        setSelectedPermissions(new Set(filteredPerms));
    };

    const handleDeselectAll = () => {
        setSelectedPermissions(new Set());
    };

    const handleBulkDelete = () => {
        onChange(value.filter(perm => !selectedPermissions.has(perm)));
        setSelectedPermissions(new Set());
    };

    const getFilteredPermissions = () => {
        if (!listSearchQuery.trim()) {
            return value;
        }
        const query = listSearchQuery.toLowerCase();
        return value.filter(perm => perm.toLowerCase().includes(query));
    };

    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {label}
                </label>
            )}

            {/* Input with Autocomplete */}
            <div className="relative">
                <div className={`input-field pl-2 pr-9 py-1.5 flex flex-wrap gap-1.5 items-center min-h-[42px] ${error ? 'border-red-300' : ''}`}>
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />

                    {/* Preview Permission Chips */}
                    {previewPermissions.map((perm) => (
                        <span
                            key={perm}
                            className="badge-info flex items-center gap-1 px-2 py-0.5 text-sm"
                        >
                            <span className="font-mono">{perm}</span>
                            <button
                                type="button"
                                onClick={() => handleRemovePreview(perm)}
                                className="hover:text-blue-900 focus:outline-none"
                                title="Remove from preview"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}

                    {/* Input Field */}
                    <div className="relative flex-1 min-w-[200px] flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                if (e.target.value.trim().length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onFocus={() => {
                                if (inputValue.trim().length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                            placeholder={previewPermissions.length === 0 ? placeholder : ''}
                            className="flex-1 outline-none border-none focus:ring-0 p-0 pl-6 min-w-0"
                        />
                    </div>

                    {/* Add Button */}
                    {previewPermissions.length > 0 && (
                        <button
                            type="button"
                            onClick={handleAddClick}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-600 hover:text-primary-700 focus:outline-none transition-colors z-10"
                            title={`Add ${previewPermissions.length} permission${previewPermissions.length !== 1 ? 's' : ''}`}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Autocomplete Dropdown */}
                {showSuggestions && (inputValue.trim().length > 0 || suggestions.length > 0) && (
                    <div
                        ref={suggestionsRef}
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto top-full"
                    >
                        {isLoadingSuggestions ? (
                            <div className="p-3 text-center text-xs text-gray-500">
                                Searching...
                            </div>
                        ) : suggestions.length > 0 ? (
                            suggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className={`w-full text-left p-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${highlightedIndex === index ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    <div className="font-medium text-sm text-gray-900">{suggestion.name}</div>
                                    {suggestion.description && (
                                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                            {suggestion.description}
                                        </div>
                                    )}
                                    {suggestion.category && (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                            {suggestion.category}
                                        </span>
                                    )}
                                </button>
                            ))
                        ) : inputValue.trim() ? (
                            <div className="p-3 text-xs text-gray-500 text-center">
                                Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> or click <Plus className="w-3 h-3 inline" /> to add &quot;{inputValue.trim()}&quot;
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Permissions List */}
            {value.length > 0 && (
                <div className="mt-3">
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                    {value.length} permission{value.length !== 1 ? 's' : ''} added
                                </span>
                                {selectedPermissions.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete ({selectedPermissions.size})
                                    </button>
                                )}
                            </div>

                            {/* Search Box */}
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={listSearchQuery}
                                    onChange={(e) => setListSearchQuery(e.target.value)}
                                    placeholder="Search permissions..."
                                    className="input-field text-xs pl-7 pr-2 py-1.5 w-full"
                                />
                            </div>

                            {/* Bulk Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                                >
                                    Select All
                                </button>
                                <span className="text-xs text-gray-400">|</span>
                                <button
                                    type="button"
                                    onClick={handleDeselectAll}
                                    className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                            {getFilteredPermissions().length > 0 ? (
                                getFilteredPermissions().map((perm) => {
                                    const isSelected = selectedPermissions.has(perm);
                                    return (
                                        <div
                                            key={perm}
                                            className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelect(perm)}
                                                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500 cursor-pointer"
                                            />
                                            <span className="flex-1 text-sm text-gray-900 font-mono break-words">{perm}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(perm)}
                                                className="flex-shrink-0 text-gray-400 hover:text-red-600 focus:outline-none transition-colors"
                                                title="Remove permission"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-xs text-gray-500">
                                    No permissions match &quot;{listSearchQuery}&quot;
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Helper Text / Error */}
            {helperText && !error && (
                <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
            )}
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
    );
};
