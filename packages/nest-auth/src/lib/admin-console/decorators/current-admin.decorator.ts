import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { NestAuthAdminUser } from '../entities/admin-user.entity';

export const CurrentAdmin = createParamDecorator(
  (data: unknown, context: ExecutionContext): NestAuthAdminUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.adminUser as NestAuthAdminUser | undefined;
  },
);
