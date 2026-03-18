import React, { useState, useEffect, useRef } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import Box from '@mui/material/Box';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounce?: number;
    className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    debounce = 300,
    className,
}) => {
    const [localValue, setLocalValue] = useState(value);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChangeRef.current(localValue);
            }
        }, debounce);
        return () => clearTimeout(timer);
    }, [localValue, value, debounce]);

    const handleClear = () => {
        setLocalValue('');
        onChange('');
    };

    return (
        <Box className={className}>
            <TextField
                fullWidth
                size="small"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder={placeholder}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                    ),
                    endAdornment: localValue ? (
                        <InputAdornment position="end">
                            <IconButton size="small" onClick={handleClear} aria-label="Clear search">
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
            />
        </Box>
    );
};
