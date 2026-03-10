import { DataSource } from 'typeorm';

export function getJsonColumnType(dataSource: DataSource): string {
    const driver = dataSource.driver;
    return driver.options.type === 'sqlite' ? 'simple-json' : 'jsonb';
}

/**
 * Detect unique constraint violation from DB driver.
 * Supports PostgreSQL (23505), MySQL (ER_DUP_ENTRY / 1062), and message fallback for SQLite/others.
 */
export function isUniqueConstraintViolation(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as Record<string, unknown>;
    const code = e.code ?? (e.driverError as Record<string, unknown>)?.code;
    const errno = (e.driverError as Record<string, unknown>)?.errno;
    if (code === '23505' || code === 'ER_DUP_ENTRY' || errno === 1062) return true;
    const msg = String(e.message ?? '').toLowerCase();
    return msg.includes('unique constraint') || msg.includes('duplicate key');
}
