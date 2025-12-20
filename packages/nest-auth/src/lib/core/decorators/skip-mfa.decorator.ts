import { SetMetadata } from '@nestjs/common';

export const SKIP_MFA_KEY = 'skipMfa';
export const SkipMfa = () => SetMetadata(SKIP_MFA_KEY, true);
