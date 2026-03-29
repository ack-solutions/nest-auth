import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import {
    Email as EmailIcon,
    Phone as PhoneIcon,
    SmsOutlined as SmsOutlinedIcon,
} from '@mui/icons-material';

export type LoginMode = 'email' | 'phone' | 'passwordless';

export interface LoginModeTabsProps {
    value: LoginMode;
    onChange: (mode: LoginMode) => void;
    disabled?: boolean;
}

/**
 * Switch between email/password, phone/password, and passwordless (OTP) sign-in.
 */
export function LoginModeTabs({ value, onChange, disabled }: LoginModeTabsProps) {
    return (
        <ToggleButtonGroup
            exclusive
            fullWidth
            value={value}
            onChange={(_, next: LoginMode | null) => next && onChange(next)}
            disabled={disabled}
            sx={{ mb: 2 }}
        >
            <ToggleButton value="email" sx={{ textTransform: 'none', gap: 0.5 }}>
                <EmailIcon fontSize="small" />
                Email
            </ToggleButton>
            <ToggleButton value="phone" sx={{ textTransform: 'none', gap: 0.5 }}>
                <PhoneIcon fontSize="small" />
                Phone
            </ToggleButton>
            <ToggleButton value="passwordless" sx={{ textTransform: 'none', gap: 0.5 }}>
                <SmsOutlinedIcon fontSize="small" />
                With OTP
            </ToggleButton>
        </ToggleButtonGroup>
    );
}
