import {
    Checkbox,
    Chip,
    Avatar,
    Stack,
    TextField,
    TextFieldProps,
    CircularProgress,
    Typography,
} from '@mui/material';
import MuiAutocomplete, {
    AutocompleteProps as MuiAutocompleteProps,
} from '@mui/material/Autocomplete';
import { keyBy, map, debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

export interface AsyncAutocompleteProps
    extends Omit<MuiAutocompleteProps<any, any, any, any>, 'renderInput' | 'onChange' | 'options'> {
    // Data fetching
    fetchOptions: (params: { search: string; page: number; limit: number }) => Promise<{
        items: any[];
        total: number;
        hasMore?: boolean;
    }>;
    // Value handling
    value?: any;
    valueKey?: string;
    labelKey?: string;
    // Optional: fetch single item by ID (for initial value resolution)
    fetchByIds?: (ids: string[]) => Promise<any[]>;
    // Display
    avatarKey?: string;
    hasAvatar?: boolean;
    label?: string;
    placeholder?: string;
    helperText?: any;
    error?: any;
    size?: 'small' | 'medium';
    required?: boolean;
    // Events
    onChange?: (values: any, fullValue?: any) => void;
    // Config
    pageSize?: number;
    debounceMs?: number;
    textFieldProps?: TextFieldProps;
    showCheckBox?: boolean;
}

export function AsyncAutocomplete({
    fetchOptions,
    fetchByIds,
    value: initialValue,
    valueKey = 'id',
    labelKey = 'name',
    avatarKey = 'avatarUrl',
    hasAvatar,
    onChange,
    required,
    label,
    placeholder,
    multiple,
    error,
    size,
    helperText,
    pageSize = 20,
    debounceMs = 300,
    textFieldProps,
    showCheckBox = false,
    limitTags = 3,
    ...otherProps
}: AsyncAutocompleteProps) {
    const [options, setOptions] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [selectedValue, setSelectedValue] = useState<any>(multiple ? [] : null);
    const [initialValueResolved, setInitialValueResolved] = useState(false);
    const listboxRef = useRef<HTMLElement | null>(null);

    const getOptionLabel = useCallback((option: any) => {
        if (!option) return '';
        if (typeof option === 'string') return option;
        if (option[labelKey]) return option[labelKey];
        if (option[valueKey]) return option[valueKey];
        return '';
    }, [labelKey, valueKey]);

    // Fetch options
    const loadOptions = useCallback(async (search: string, pageNum: number, append = false) => {
        setLoading(true);
        try {
            const result = await fetchOptions({ search, page: pageNum, limit: pageSize });
            const newOptions = result.items || [];

            if (append) {
                setOptions(prev => {
                    // Deduplicate by valueKey
                    const existingIds = new Set(prev.map(o => o[valueKey]));
                    const uniqueNew = newOptions.filter(o => !existingIds.has(o[valueKey]));
                    return [...prev, ...uniqueNew];
                });
            } else {
                setOptions(newOptions);
            }

            setHasMore(result.hasMore ?? newOptions.length >= pageSize);
        } catch (err) {
            console.error('Failed to fetch options:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchOptions, pageSize, valueKey]);

    // Debounced search
    const debouncedSearch = useMemo(
        () => debounce((search: string) => {
            setPage(1);
            loadOptions(search, 1, false);
        }, debounceMs),
        [loadOptions, debounceMs]
    );

    // Initial load
    useEffect(() => {
        loadOptions('', 1, false);
    }, []);

    // Resolve initial value to full objects
    useEffect(() => {
        if (initialValueResolved || !initialValue) {
            if (!initialValue) {
                setSelectedValue(multiple ? [] : null);
            }
            return;
        }

        const resolveInitialValue = async () => {
            if (fetchByIds) {
                // Fetch full objects by IDs
                const ids = multiple
                    ? (Array.isArray(initialValue) ? initialValue : [initialValue])
                    : [initialValue];

                const stringIds = ids.map(id => typeof id === 'object' ? id[valueKey] : id);
                const resolved = await fetchByIds(stringIds);

                if (multiple) {
                    setSelectedValue(resolved);
                } else {
                    setSelectedValue(resolved[0] || null);
                }
            } else {
                // Try to find in current options
                const byValueKey = keyBy(options, valueKey);

                if (multiple) {
                    const ids = Array.isArray(initialValue) ? initialValue : [initialValue];
                    const resolved = ids.map(id => {
                        const key = typeof id === 'object' ? id[valueKey] : id;
                        return byValueKey[key] || { [valueKey]: key, [labelKey]: key };
                    });
                    setSelectedValue(resolved);
                } else {
                    const key = typeof initialValue === 'object' ? initialValue[valueKey] : initialValue;
                    setSelectedValue(byValueKey[key] || { [valueKey]: key, [labelKey]: key });
                }
            }
            setInitialValueResolved(true);
        };

        resolveInitialValue();
    }, [initialValue, options, valueKey, labelKey, multiple, fetchByIds, initialValueResolved]);

    // Handle input change (search)
    const handleInputChange = useCallback((_event: any, newInputValue: string) => {
        setInputValue(newInputValue);
        debouncedSearch(newInputValue);
    }, [debouncedSearch]);

    // Handle value change
    const handleOnChange = useCallback((_event: any, newValue: any) => {
        setSelectedValue(newValue);

        let outputValue: any;
        if (valueKey) {
            if (multiple) {
                outputValue = map(newValue, valueKey);
            } else {
                outputValue = newValue?.[valueKey] ?? null;
            }
        } else {
            outputValue = newValue;
        }

        onChange?.(outputValue, newValue);
    }, [multiple, onChange, valueKey]);

    // Handle scroll for infinite loading
    const handleListboxScroll = useCallback((event: React.UIEvent<HTMLUListElement>) => {
        const listbox = event.currentTarget;
        const scrollBottom = listbox.scrollHeight - listbox.scrollTop - listbox.clientHeight;

        if (scrollBottom < 50 && !loading && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadOptions(inputValue, nextPage, true);
        }
    }, [loading, hasMore, page, inputValue, loadOptions]);

    return (
        <MuiAutocomplete
            multiple={multiple}
            options={options}
            getOptionLabel={getOptionLabel}
            filterOptions={(x) => x} // Disable client-side filtering, we use server-side
            isOptionEqualToValue={(option, value) => {
                if (!option || !value) return false;
                return option[valueKey] === value[valueKey];
            }}
            renderOption={(props, option, { selected }) => (
                <Stack
                    direction="row"
                    spacing={0.5}
                    component="li"
                    alignItems="center"
                    {...props}
                >
                    {multiple && showCheckBox && <Checkbox checked={selected} />}
                    {hasAvatar && (
                        <Avatar
                            alt={getOptionLabel(option)}
                            src={option[avatarKey]}
                            sx={{ width: 24, height: 24, marginRight: 1 }}
                        />
                    )}
                    <Typography variant="body2">{getOptionLabel(option)}</Typography>
                </Stack>
            )}
            renderTags={(value, getTagProps) => (
                <>
                    {value.slice(0, limitTags).map((option: any, index) => (
                        <Chip
                            key={option[valueKey]}
                            size="small"
                            avatar={hasAvatar ? (
                                <Avatar alt={getOptionLabel(option)} src={option[avatarKey]} />
                            ) : undefined}
                            label={getOptionLabel(option)}
                            {...getTagProps({ index })}
                        />
                    ))}
                    {value.length > limitTags && (
                        <Typography variant="body2" sx={{ ml: 0.5 }}>
                            +{value.length - limitTags}
                        </Typography>
                    )}
                </>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    variant="outlined"
                    label={label}
                    placeholder={placeholder}
                    error={Boolean(error)}
                    helperText={error?.message || helperText}
                    required={required}
                    size={size}
                    {...textFieldProps}
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading && <CircularProgress color="inherit" size={20} />}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
            value={selectedValue}
            inputValue={inputValue}
            onChange={handleOnChange}
            onInputChange={handleInputChange}
            loading={loading}
            loadingText="Loading..."
            noOptionsText={loading ? 'Loading...' : 'No options'}
            ListboxProps={{
                onScroll: handleListboxScroll,
                ref: listboxRef as any,
                sx: { maxHeight: 300 }
            }}
            {...otherProps}
        />
    );
}
