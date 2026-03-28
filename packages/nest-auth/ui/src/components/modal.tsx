import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export interface ModalProps {
    /** MUI standard prop */
    open?: boolean;
    /** @deprecated Use open */
    isOpen?: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    /** Optional subtitle below title */
    subTitle?: string;
    /** @deprecated Use subTitle */
    description?: string;
    footer?: React.ReactNode;
    /** MUI standard: xs, sm, md, lg, xl. Legacy 2xl/3xl/5xl map to xl. Default sm. */
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '5xl';
    fullScreen?: boolean;
    icon?: React.ReactNode;
    tabs?: React.ReactNode;
}

export const ModalFooter = ({ footer }: { footer: React.ReactNode }) => (
    <DialogActions sx={{ px: 2, py: 1.5 }}>{footer}</DialogActions>
);

export const ModalContent = ({ children }: { children: React.ReactNode }) => (
    <DialogContent>{children}</DialogContent>
);

export const Modal: React.FC<ModalProps> = ({
    open: openProp,
    isOpen,
    onClose,
    title,
    subTitle,
    description,
    children,
    footer,
    maxWidth = 'sm',
    fullScreen = false,
    icon,
    tabs,
}) => {
    const open = openProp ?? isOpen ?? false;
    const subtitle = subTitle ?? description;
    const muiMaxWidth = (
        fullScreen
            ? false
            : ['2xl', '3xl', '5xl'].includes(maxWidth ?? '')
              ? 'xl'
              : (maxWidth ?? 'sm')
    ) as false | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={muiMaxWidth}
            fullWidth={!fullScreen && maxWidth !== 'xs'}
            fullScreen={fullScreen}
            PaperProps={{
                sx: { ...(fullScreen ? {} : { maxHeight: '90vh' }) },
            }}
        >
            <DialogTitle
                component="div"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 1.5,
                    px: 2,
                    borderBottom: tabs ? 1 : 0,
                    borderColor: 'divider',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                    {icon}
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" component="span" fontWeight={600}>
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary" display="block">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{ color: 'text.secondary', flexShrink: 0 }}
                    aria-label="Close"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            {tabs && (
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    {tabs}
                </Box>
            )}
            <DialogContent
                sx={{
                    px: 2,
                    py: 2,
                    flex: '1 1 auto',
                    minHeight: 0,
                    overflowY: 'auto',
                }}
            >
                {children}
            </DialogContent>
            {footer != null && <DialogActions sx={{ px: 2, py: 1.5 }}>{footer}</DialogActions>}
        </Dialog>
    );
};
