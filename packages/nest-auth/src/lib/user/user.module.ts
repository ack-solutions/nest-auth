import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthUser } from './entities/user.entity';
import { UserService } from './services/user.service';
import { AccessKeyService } from './services/access-key.service';
import { AuthModule } from '../auth/auth.module';
import { NestAuthAccessKey } from './entities/access-key.entity';
import { NestAuthIdentity } from './entities/identity.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthUser, NestAuthAccessKey, NestAuthIdentity]),
        forwardRef(() => AuthModule),
        forwardRef(() => TenantModule),
    ],
    providers: [
        UserService,
        AccessKeyService,
    ],
    exports: [
        UserService,
        AccessKeyService,
    ],
})
export class UserModule { }
