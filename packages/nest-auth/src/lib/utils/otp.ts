import { randomBytes } from 'crypto';

export function generateOtp(length: number = 6, format: 'numeric' | 'alphanumeric' = 'numeric'): string {
    if (format === 'numeric') {
        return Math.floor(10 ** (length - 1) + Math.random() * (10 ** length - 10 ** (length - 1) - 1)).toString();
    } else {
        return randomBytes(length).toString('hex').substring(0, length);
    }
}
