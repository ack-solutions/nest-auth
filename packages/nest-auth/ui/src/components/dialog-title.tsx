import React from 'react';
import MuiDialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { DialogProps as MuiDialogProps } from '@mui/material/Dialog';

export interface DialogTitleBarProps {
    title: React.ReactNode;
    subTitle?: React.ReactNode;
    icon?: React.ReactNode;
    /** Wired to the header close control; typically the parent `Dialog`’s `onClose` */
    onClose?: MuiDialogProps['onClose'];
    /** When true, draws a bottom border (e.g. when a tab row follows) */
    showBottomDivider?: boolean;
}

/**
 * Standard dialog header: optional leading icon, title + optional subtitle (Typography), close button.
 */
export const DialogTitleBar: React.FC<DialogTitleBarProps> = ({
    title,
    subTitle,
    icon,
    onClose,
    showBottomDivider = false,
}) => (
    <MuiDialogTitle
        component="div"
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            py: 1.5,
            px: 2,
            borderBottom: showBottomDivider ? 1 : 0,
            borderColor: 'divider',
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            {icon}
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" component="span" fontWeight={600}>
                    {title}
                </Typography>
                {subTitle && (
                    <Typography variant="body2" color="text.secondary" display="block">
                        {subTitle}
                    </Typography>
                )}
            </Box>
        </Box>
        <IconButton
            onClick={(event) => onClose?.(event, 'backdropClick')}
            size="small"
            sx={{ color: 'text.secondary', flexShrink: 0 }}
            aria-label="Close"
        >
            <CloseIcon fontSize="small" />
        </IconButton>
    </MuiDialogTitle>
);
