import { JWTTokenPayload, SessionPayload } from '../interfaces/token-payload.interface';
import { NestAuthUserAccess } from '../tenant/entities/user-access.entity';

declare global {
    namespace Express {
        interface Request {
            user?: JWTTokenPayload;
            session?: SessionPayload;
            tenantId?: string | null;
            userAccess?: NestAuthUserAccess | null;
            newTokens?: {
                accessToken: string;
                refreshToken: string;
            };
        }
    }
}
