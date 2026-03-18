import { alpha } from '@mui/material/styles';

export type ColorSchema =
    | 'primary'
    | 'secondary'
    | 'info'
    | 'success'
    | 'warning'
    | 'error';

declare module '@mui/material' {
    interface TypeBackground {
        neutral: string;
    }

    interface SimplePaletteColorOptions {
        lighter?: string;
        darker?: string;
    }

    interface PaletteColor {
        lighter: string;
        darker: string;
    }
}

export const GREY = {
    50: '#FCFDFD',
    100: '#F9FAFB',
    200: '#F4F6F8',
    300: '#DFE3E8',
    400: '#C4CDD5',
    500: '#919EAB',
    600: '#637381',
    700: '#454F5B',
    800: '#1C252E',
    900: '#141A21',
    lighter: '#F9FAFB',
    light: '#DFE3E8',
    main: '#919EAB',
    dark: '#454F5B',
    darker: '#161C24',
    contrastText: '#FFFFFF',
};

export const PRIMARY = {
    lighter: '#e0f2fe',
    light: '#38bdf8',
    main: '#0284c7',
    dark: '#0369a1',
    darker: '#0c4a6e',
    contrastText: '#FFFFFF',
};

export const SECONDARY = {
    lighter: '#f3e8ff',
    light: '#94a3b8',
    main: '#64748b',
    dark: '#475569',
    darker: '#334155',
    contrastText: '#FFFFFF',
};

export const INFO = {
    lighter: '#dbeafe',
    light: '#93c5fd',
    main: '#2563eb',
    dark: '#1d4ed8',
    darker: '#1e40af',
    contrastText: '#FFFFFF',
};

export const SUCCESS = {
    lighter: '#dcfce7',
    light: '#bbf7d0',
    main: '#16a34a',
    dark: '#15803d',
    darker: '#166534',
    contrastText: '#ffffff',
};

export const WARNING = {
    lighter: '#fef3c7',
    light: '#fde68a',
    main: '#ca8a04',
    dark: '#a16207',
    darker: '#854d0e',
    contrastText: '#1C252E',
};

export const ERROR = {
    lighter: '#fee2e2',
    light: '#fecaca',
    main: '#dc2626',
    dark: '#b91c1c',
    darker: '#991b1b',
    contrastText: '#FFFFFF',
};

export const COMMON = {
    common: {
        black: '#000000',
        white: '#FFFFFF',
    },
    primary: PRIMARY,
    secondary: SECONDARY,
    info: INFO,
    success: SUCCESS,
    warning: WARNING,
    error: ERROR,
    grey: GREY,
    divider: alpha(GREY[500], 0.2),
    action: {
        hover: alpha(GREY[500], 0.08),
        selected: alpha(GREY[500], 0.16),
        disabled: alpha(GREY[500], 0.8),
        disabledBackground: alpha(GREY[500], 0.24),
        focus: alpha(GREY[500], 0.24),
        hoverOpacity: 0.08,
        disabledOpacity: 0.48,
    },
};

export const lightPalette = {
    ...COMMON,
    text: {
        primary: GREY[800],
        secondary: GREY[600],
        disabled: GREY[500],
    },
    background: {
        paper: '#FFFFFF',
        default: alpha(GREY[500], 0.2),
        neutral: '#F5F7FA',
    },
    action: {
        ...COMMON.action,
        active: GREY[600],
    },
};

export const darkPalette = {
    ...COMMON,
    text: {
        primary: '#FFFFFF',
        secondary: GREY[500],
        disabled: GREY[600],
    },
    background: {
        paper: GREY[800],
        default: GREY[900],
        neutral: alpha(GREY[500], 0.12),
    },
    action: {
        ...COMMON.action,
        active: GREY[500],
    },
};

export function palette(mode: 'light' | 'dark') {
    return mode === 'light' ? lightPalette : darkPalette;
}

export const colorSchemes = {
    light: { palette: lightPalette },
    dark: { palette: darkPalette },
};
