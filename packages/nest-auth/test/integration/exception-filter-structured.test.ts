/**
 * Regression: AuthExceptionFilter must not strip structured exception fields.
 *
 * A handler throwing `new UnprocessableEntityException({ message, errors })`
 * (or `problems`, or any structured payload — per-row import errors were the
 * reported case) had its body rebuilt by the filter as only
 * `{ statusCode, error, message, code? }`: every extra key was discarded, so
 * clients only ever saw the summary string. The filter now forwards the extra
 * keys while keeping the normalized envelope — in particular `message` stays a
 * SINGLE string (the first of a validation array), because installed clients
 * parse it. NO MOCKS — real controller, real filter, real HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, UnauthorizedException, UnprocessableEntityException, UseFilters } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';
import { AuthExceptionFilter } from '../../src/lib/auth/filters/auth-exception.filter';

@Controller('filtered')
@UseFilters(AuthExceptionFilter)
class FilteredController {
    @Get('import-errors')
    importErrors() {
        // The reported shape: POST /meters/import answering 422 with per-row errors.
        throw new UnprocessableEntityException({
            message: ['Row 2: meter not found', 'Row 5: duplicate reading'],
            errors: { 2: 'meter not found', 5: 'duplicate reading' },
            problems: [{ row: 2, reason: 'meter not found' }],
        });
    }

    @Get('plain')
    plain() {
        throw new UnauthorizedException({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    @Get('string-body')
    stringBody() {
        throw new UnauthorizedException('nope');
    }
}

describe('AuthExceptionFilter — structured fields survive normalization', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({ extraControllers: [FilteredController] });
    }, 60_000);

    afterAll(async () => {
        await handle?.close();
    });

    it('forwards errors/problems on a 422 (was: silently dropped)', async () => {
        const res = await request(handle.httpServer).get('/filtered/import-errors');
        expect(res.status).toBe(422);
        expect(res.body.errors).toEqual({ 2: 'meter not found', 5: 'duplicate reading' });
        expect(res.body.problems).toEqual([{ row: 2, reason: 'meter not found' }]);
        // The envelope is still normalized: message is ONE string (first of the
        // array) — installed clients parse it and an array would break them.
        expect(res.body.message).toBe('Row 2: meter not found');
        expect(res.body.statusCode).toBe(422);
    });

    it('a plain structured error keeps its exact historical shape (no new keys)', async () => {
        const res = await request(handle.httpServer).get('/filtered/plain');
        expect(res.status).toBe(401);
        expect(Object.keys(res.body).sort()).toEqual(['code', 'error', 'message', 'statusCode']);
        expect(res.body).toMatchObject({ statusCode: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    });

    it('a string-bodied exception is unchanged', async () => {
        const res = await request(handle.httpServer).get('/filtered/string-body');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('nope');
        expect(res.body.code).toBeUndefined();
    });

    it("nest-auth's own error responses keep their shape (login 401)", async () => {
        const res = await request(handle.httpServer)
            .post('/auth/login')
            .send({ providerName: 'email', credentials: { email: 'nobody@test.local', password: 'Wrong!1x' } });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(typeof res.body.message).toBe('string');
        expect(res.body.code).toBeTruthy();
    });
});
