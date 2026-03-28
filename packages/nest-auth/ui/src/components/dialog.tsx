import React from 'react';
import MuiDialog, { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import { DialogTitleBar } from './dialog-title';

export type { DialogTitleBarProps } from './dialog-title';
export { DialogTitleBar };

export interface DialogProps extends MuiDialogProps {
    title: string;
    children: React.ReactNode;
    /** Optional subtitle below title */
    subTitle?: string;
    /** Footer area (e.g. `<FormFooter actions={...} />` or custom buttons) */
    actions?: React.ReactNode;
    /** MUI standard: xs, sm, md, lg, xl. Legacy 2xl/3xl/5xl map to xl. Default sm. */
    icon?: React.ReactNode;
    tabs?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
    title,
    subTitle,
    children,
    actions,
    icon,
    tabs,
    fullScreen,
    ...dialogProps
}) => {
    return (
        <MuiDialog
            fullScreen={fullScreen}
            slotProps={{
                paper: {
                    sx: {
                        ...(fullScreen ? {} : { maxHeight: '90vh' })
                    },
                },
            }}
            {...dialogProps}
        >
            <DialogTitleBar
                title={title}
                subTitle={subTitle}
                icon={icon}
                onClose={dialogProps.onClose}
                showBottomDivider={!!tabs}
            />
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
            {actions != null && <DialogActions sx={{ px: 2, py: 1.5 }}>{actions}</DialogActions>}
        </MuiDialog>
    );
};
