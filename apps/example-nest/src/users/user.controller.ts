import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Crud } from '@ackplus/nest-auth';
import { User } from '../database/entities/user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@Crud({
  entity: User,
  routes: {
    findMany: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}

  // Custom endpoints
  @Get('active')
  @ApiOperation({ 
    summary: 'Get all active users',
    description: 'Returns all users where isActive is true, including their posts'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of active users',
    type: [User]
  })
  async getActiveUsers(): Promise<User[]> {
    return this.service.findActiveUsers();
  }

  @Get('role/:role')
  @ApiOperation({ 
    summary: 'Get users by role',
    description: 'Returns all users with the specified role'
  })
  @ApiParam({ 
    name: 'role', 
    description: 'User role (e.g., admin, user, moderator)',
    example: 'admin'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of users with the specified role',
    type: [User]
  })
  async getUsersByRole(@Param('role') role: string): Promise<User[]> {
    return this.service.findByRole(role);
  }

  @Get('email/:email')
  @ApiOperation({ 
    summary: 'Get user by email',
    description: 'Returns a single user with the specified email address'
  })
  @ApiParam({ 
    name: 'email', 
    description: 'User email address',
    example: 'john@example.com'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User with the specified email',
    type: User
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async getUserByEmail(@Param('email') email: string): Promise<User | null> {
    return this.service.findByEmail(email);
  }
}

