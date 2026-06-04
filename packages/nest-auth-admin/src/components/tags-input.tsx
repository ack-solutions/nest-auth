import React, { useState, KeyboardEvent, useId } from 'react';
import { X, Plus } from 'lucide-react';
import { Box, Chip, Icon, InputBase, IconButton, Typography } from '@mui/material';

interface TagsInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    label?: string;
    helperText?: string;
    id?: string;
}

export const TagsInput: React.FC<TagsInputProps> = ({
    value,
    onChange,
    placeholder = 'Type and press Enter...',
    label,
    helperText,
    id: providedId,
}) => {
    const [inputValue, setInputValue] = useState('');
    const generatedId = useId();
    const id = providedId || generatedId;

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            removeTag(value[value.length - 1]);
        }
    };

    const addTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
            setInputValue('');
        }
    };

    const removeTag = (tag: string) => {
        onChange(value.filter((t) => t !== tag));
    };

    return (
        <Box sx={{ width: '100%' }}>
            {label && (
                <Typography component="label" htmlFor={id} variant="body2" fontWeight="500" color="text.primary" sx={{ display: 'block', mb: 1 }}>
                    {label}
                </Typography>
            )}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                    minHeight: 42,
                    px: 1.5,
                    py: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 1px var(--mui-palette-primary-main)' },
                }}
            >
                {value.map((tag) => (
                    <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        onDelete={() => removeTag(tag)}
                        deleteIcon={<Icon component={X} sx={{ fontSize: 12 }} />}
                        sx={{ fontWeight: 500 }}
                    />
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 120 }}>
                    <InputBase
                        id={id}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={value.length === 0 ? placeholder : ''}
                        sx={{ flex: 1, minWidth: 0, '& input': { py: 0.5 } }}
                    />
                    {inputValue.trim() && (
                        <IconButton size="small" onClick={addTag} sx={{ color: 'primary.main' }}>
                            <Icon component={Plus} sx={{ fontSize: 16 }} />
                        </IconButton>
                    )}
                </Box>
            </Box>
            {helperText && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {helperText}
                </Typography>
            )}
        </Box>
    );
};
