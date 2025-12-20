import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '../entities/admin-user.entity';

export const CurrentAdmin = createParamDecorator(
  (data: unknown, context: ExecutionContext): AdminUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.adminUser as AdminUser | undefined;
  },
);
