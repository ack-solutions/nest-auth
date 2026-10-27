import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthUser } from './entities/user.entity';
import { UserService } from './services/user.service';
import { AccessKeyService } from './services/access-key.service';
import { AuthModule } from '../auth/auth.module';
import { NestAuthAccessKey } from './entities/access-key.entity';
import { NestAuthIdentity } from './entities/identity.entity';
import { TenantModule } from '../tenant/tenant.module';
import { NestAuthUserAccess } from './entities/user-access.entity';
import { NestAuthPlatformAccess } from './entities/platform-access.entity';
import { SessionModule } from '../session/session.module';
import { NestAuthUserCacheSubscriber } from './subscribers/user-cache.subscriber';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthUser, NestAuthAccessKey, NestAuthIdentity, NestAuthUserAccess, NestAuthPlatformAccess]),
        forwardRef(() => AuthModule),
        forwardRef(() => TenantModule),
        // For NestAuthCacheService, which the cache-invalidation subscriber needs.
        forwardRef(() => SessionModule),
    ],
    providers: [
        UserService,
        AccessKeyService,
        // Keeps the guard's cached user state honest: every ORM write to
        // NestAuthUser drops that account's entry.
        NestAuthUserCacheSubscriber,
    ],
    exports: [
        UserService,
        AccessKeyService,
    ],
})
export class UserModule { }
