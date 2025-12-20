import { JWTTokenPayload, SessionPayload } from '../interfaces/token-payload.interface';

declare global {
    namespace Express {
        interface Request {
            user?: JWTTokenPayload;
            session?: SessionPayload;
            newTokens?: {
                accessToken: string;
                refreshToken: string;
            };
        }
    }
}
