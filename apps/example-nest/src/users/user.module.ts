import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from '../database/entities/user.entity';
import { Post } from '../database/entities/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

