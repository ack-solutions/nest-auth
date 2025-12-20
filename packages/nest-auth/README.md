# @ackplus/nest-auth

Powerful CRUD operations for NestJS with TypeORM - automatic REST endpoints, advanced filtering, relations, pagination, and more.

## Features

- 🚀 **Automatic CRUD endpoints** - Generate complete REST APIs with a single decorator
- 🔍 **Advanced filtering** - Support for complex where conditions with multiple operators
- 🔗 **Relations handling** - Automatically load and filter related entities
- 📄 **Pagination** - Built-in pagination with skip/take support
- 🎯 **Field selection** - Select specific fields to return
- 📚 **Swagger integration** - Automatic API documentation
- 🛡️ **Validation** - Built-in request validation with class-validator
- 🔧 **Customizable** - Override default behavior with hooks and custom logic
- 🐛 **Debug mode** - Step-by-step query builder logs

## Installation

```bash
npm install @ackplus/nest-auth
# or
pnpm add @ackplus/nest-auth
# or
yarn add @ackplus/nest-auth
```

## Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm class-validator class-transformer reflect-metadata
```

## Quick Start

### 1. Create your entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Post } from './post.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
```

### 2. Create a CRUD controller

```typescript
import { Controller } from '@nestjs/common';
import { Crud } from '@ackplus/nest-auth';
import { User } from './user.entity';
import { UserService } from './user.service';

@Crud({
  entity: User,
  routes: {
    findAll: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}
}
```

### 3. Create a CRUD service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-auth';
import { User } from './user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    protected repository: Repository<User>,
  ) {
    super(repository);
  }
}
```

### 4. Register in your module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

That's it! Your API is ready with the following endpoints:

- `GET /users` - Get all users with filtering, pagination, relations
- `GET /users/:id` - Get a single user
- `POST /users` - Create a new user
- `PATCH /users/:id` - Update a user
- `DELETE /users/:id` - Delete a user

## API Usage Examples

### Basic Queries

```bash
# Get all users
GET /users

# Get a specific user
GET /users/1

# Create a user
POST /users
{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}

# Update a user
PATCH /users/1
{
  "firstName": "Jane"
}

# Delete a user
DELETE /users/1
```

### Advanced Filtering

The query parameters are parsed from the URL and support complex filtering:

```bash
# Filter by equality
GET /users?where={"email":{"$eq":"john@example.com"}}

# Filter by multiple conditions
GET /users?where={"isActive":{"$eq":true},"role":{"$eq":"admin"}}

# Greater than / Less than
GET /users?where={"age":{"$gt":18}}
GET /users?where={"age":{"$gte":18}}
GET /users?where={"age":{"$lt":65}}
GET /users?where={"age":{"$lte":65}}

# IN operator
GET /users?where={"role":{"$in":["admin","moderator"]}}

# NOT IN operator
GET /users?where={"role":{"$notIn":["banned","suspended"]}}

# LIKE operator (case-sensitive)
GET /users?where={"email":{"$like":"%@example.com"}}

# ILIKE operator (case-insensitive)
GET /users?where={"firstName":{"$iLike":"%john%"}}

# IS NULL / IS NOT NULL
GET /users?where={"deletedAt":{"$isNull":true}}
GET /users?where={"deletedAt":{"$isNotNull":true}}

# BETWEEN
GET /users?where={"age":{"$between":[18,65]}}

# Logical operators - AND
GET /users?where={"$and":[{"isActive":{"$eq":true}},{"role":{"$eq":"admin"}}]}

# Logical operators - OR
GET /users?where={"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]}

# Complex nested conditions
GET /users?where={"$and":[{"isActive":{"$eq":true}},{"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]}]}
```

### Relations

```bash
# Load relations
GET /users?relations=["posts"]

# Load nested relations
GET /users?relations=["posts","posts.comments"]

# Load relations with specific fields
GET /users?relations={"posts":{"select":["id","title"]}}

# Load relations with filtering
GET /users?relations={"posts":{"where":{"published":{"$eq":true}}}}

# Load relations with join type
GET /users?relations={"posts":{"joinType":"left"}}
```

### Field Selection

```bash
# Select specific fields
GET /users?select=["id","email","firstName"]

# Combine with relations
GET /users?select=["id","email"]&relations={"posts":{"select":["id","title"]}}
```

### Pagination

```bash
# Skip and take
GET /users?skip=0&take=10

# Page 2 (skip 10, take 10)
GET /users?skip=10&take=10
```

### Sorting

```bash
# Sort by single field
GET /users?order={"createdAt":"DESC"}

# Sort by multiple fields
GET /users?order={"createdAt":"DESC","email":"ASC"}
```

### Soft Deletes

```bash
# Include soft-deleted records
GET /users?withDeleted=true

# Only show soft-deleted records
GET /users?onlyDeleted=true
```

## Advanced Configuration

### Custom Routes

```typescript
@Crud({
  entity: User,
  routes: {
    findAll: {
      decorators: [UseGuards(AuthGuard)], // Add guards
    },
    findOne: true,
    create: {
      decorators: [UseInterceptors(LoggingInterceptor)], // Add interceptors
    },
    update: true,
    delete: false, // Disable delete endpoint
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}
}
```

### Custom Actions

```typescript
@Crud({
  entity: User,
  routes: {
    findAll: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}

  // Add custom endpoints
  @Get('active')
  async getActiveUsers() {
    return this.service.find({
      where: { isActive: true },
    });
  }
}
```

### Service Customization

```typescript
@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    protected repository: Repository<User>,
  ) {
    super(repository);
  }

  // Override create method
  async create(data: Partial<User>): Promise<User> {
    // Add custom logic before create
    const hashedPassword = await this.hashPassword(data.password);
    data.password = hashedPassword;

    return super.create(data);
  }

  // Override update method
  async update(id: number, data: Partial<User>): Promise<User> {
    // Add custom logic before update
    if (data.password) {
      data.password = await this.hashPassword(data.password);
    }

    return super.update(id, data);
  }

  // Add custom methods
  async findByEmail(email: string): Promise<User> {
    return this.repository.findOne({ where: { email } });
  }

  private async hashPassword(password: string): Promise<string> {
    // Your hashing logic
    return password;
  }
}
```

### Validation

Use class-validator decorators on your DTOs:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Then use it in your controller:

```typescript
@Crud({
  entity: User,
  dto: {
    create: CreateUserDto,
    update: UpdateUserDto,
  },
  routes: {
    findAll: true,
    findOne: true,
    create: true,
    update: true,
    delete: true,
  },
})
@Controller('users')
export class UserController {
  constructor(public service: UserService) {}
}
```

## Query Builder Debugging

Enable debug mode to see step-by-step query builder logs:

### Option 1: Query Parameter

```bash
GET /users?debug=true
```

### Option 2: Environment Variable

```bash
NEST_CRUD_DEBUG=1
```

Debug logs will appear in the console prefixed with `[NestCrud:<builder>]` showing:
- Pagination logic
- Join construction
- Relations processing
- Where clause building

Example output:

```
[NestCrud:FindQueryBuilder] Building query with options: {...}
[NestCrud:JoinQueryBuilder] Processing relations: ["posts"]
[NestCrud:WhereQueryBuilder] Building where clause: {"isActive":{"$eq":true}}
```

## TypeORM Query Builder Integration

You can also use the underlying query builder helpers directly:

```typescript
import { FindQueryBuilder } from '@ackplus/nest-auth';

const queryBuilder = new FindQueryBuilder(repository);
const result = await queryBuilder.build({
  where: { isActive: true },
  relations: ['posts'],
  select: ['id', 'email', 'firstName'],
  skip: 0,
  take: 10,
  order: { createdAt: 'DESC' },
});
```

## Operators Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal | `{"age":{"$eq":25}}` |
| `$ne` | Not equal | `{"status":{"$ne":"banned"}}` |
| `$gt` | Greater than | `{"age":{"$gt":18}}` |
| `$gte` | Greater than or equal | `{"age":{"$gte":18}}` |
| `$lt` | Less than | `{"age":{"$lt":65}}` |
| `$lte` | Less than or equal | `{"age":{"$lte":65}}` |
| `$in` | In array | `{"role":{"$in":["admin","mod"]}}` |
| `$notIn` | Not in array | `{"role":{"$notIn":["banned"]}}` |
| `$like` | Like (case-sensitive) | `{"email":{"$like":"%@example.com"}}` |
| `$notLike` | Not like | `{"email":{"$notLike":"%spam%"}}` |
| `$iLike` | Like (case-insensitive) | `{"name":{"$iLike":"%john%"}}` |
| `$notIlike` | Not like (case-insensitive) | `{"name":{"$notIlike":"%test%"}}` |
| `$isNull` | Is null | `{"deletedAt":{"$isNull":true}}` |
| `$isNotNull` | Is not null | `{"deletedAt":{"$isNotNull":true}}` |
| `$between` | Between | `{"age":{"$between":[18,65]}}` |
| `$notBetween` | Not between | `{"age":{"$notBetween":[0,17]}}` |
| `$isTrue` | Is true | `{"isActive":{"$isTrue":true}}` |
| `$isFalse` | Is false | `{"isActive":{"$isFalse":true}}` |
| `$and` | Logical AND | `{"$and":[{...},{...}]}` |
| `$or` | Logical OR | `{"$or":[{...},{...}]}` |

## Best Practices

1. **Use DTOs for validation** - Always create separate DTOs for create and update operations
2. **Limit field selection** - Use `select` parameter to reduce payload size
3. **Paginate large datasets** - Always use `skip` and `take` for large collections
4. **Index your filters** - Add database indexes for frequently filtered fields
5. **Limit relations depth** - Avoid loading too many nested relations
6. **Use guards** - Protect your endpoints with authentication and authorization guards
7. **Handle errors** - Implement proper error handling in your services
8. **Enable debug mode** - Use debug mode during development to understand query construction

## Examples

See the [example-app](../../apps/example-app) directory for a complete working example with:
- User and Post entities with relations
- CRUD controllers and services
- Custom endpoints
- Validation
- Seeders for test data

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
