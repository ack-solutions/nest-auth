import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from './user.entity';
import { UserService } from './user.service';
import { UserEventListener } from './user.event-listener';

@Module({
    imports: [TypeOrmModule.forFeature([AppUser])],
    providers: [UserService, UserEventListener],
    exports: [UserService],
})
export class UserModule {}

