import type { Theme, Components } from '@mui/material/styles';


const MuiCard: Components<Theme>['MuiCard'] = {
    styleOverrides: {
        root: ({ theme }) => ({
            position: 'relative',
            boxShadow: theme.customShadows.card,
            zIndex: 0,
        }),
    },
};

const MuiCardHeader: Components<Theme>['MuiCardHeader'] = {
    defaultProps: {
        titleTypographyProps: { variant: 'h6' },
        subheaderTypographyProps: {
            variant: 'body2',
            marginTop: '4px',
        },
    },
    styleOverrides: {
        root: ({ theme }) => ({
            padding: theme.spacing(1.5, 2, 1.5),
            [theme.breakpoints.down('md')]: {
                padding: theme.spacing(2, 2, 0.5),
            },
        }),
        action: {
            alignSelf: 'center',
        },
    },
};

const MuiCardContent: Components<Theme>['MuiCardContent'] = {
    styleOverrides: {
        root: ({ theme }) => ({
            padding: theme.spacing(2),
            [theme.breakpoints.down('md')]: {
                padding: theme.spacing(2),
            },
        }),
    },
};

const MuiCardActions: Components<Theme>['MuiCardActions'] = {
    styleOverrides: {
        root: ({ theme }) => ({
            padding: theme.spacing(2),
            [theme.breakpoints.down('md')]: {
                padding: theme.spacing(2),
            },
        }),
    },
};


export const card = {
    MuiCard,
    MuiCardHeader,
    MuiCardContent,
    MuiCardActions,
};
