# Example App - @ackplus/nest-auth

Complete working example demonstrating `@ackplus/nest-auth` with TypeORM and SQLite.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# From root directory
pnpm install
```

### 2. Build the nest-auth Package

```bash
# Build nest-auth package
pnpm -C packages/nest-auth build
```

### 3. Seed Database

```bash
# From example-app directory
cd apps/example-app

# Seed database with test data
pnpm seed

# Or refresh (drop and reseed)
pnpm seed:refresh
```

### 4. Start Application

```bash
pnpm start:dev
```

The API will be available at:
- **API Base URL**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/api` 📚

## 📚 Swagger API Documentation

Once the app is running, open your browser and navigate to:

**http://localhost:3000/api**

The Swagger UI provides:
- 📖 Interactive API documentation
- 🧪 Built-in API testing interface
- 📝 Request/response examples
- 🎯 Try out all endpoints directly from the browser
- 🔍 Search and filter endpoints
- 📊 See all available query parameters

### Features in Swagger

1. **Try It Out** - Test any endpoint directly from the browser
2. **Request Examples** - See example requests for all endpoints
3. **Response Schemas** - View response structures
4. **Query Parameters** - See all available filters, relations, pagination options
5. **Models** - Explore User and Post entity structures

## 📚 API Documentation

### Users API

#### Get All Users

```bash
# Get all users
GET http://localhost:3000/users

# Get users with pagination
GET http://localhost:3000/users?skip=0&take=10

# Get users with relations
GET http://localhost:3000/users?relations=["posts"]

# Filter users
GET http://localhost:3000/users?where={"isActive":{"$eq":true}}

# Complex filtering
GET http://localhost:3000/users?where={"$and":[{"isActive":{"$eq":true}},{"role":{"$eq":"admin"}}]}

# Sort users
GET http://localhost:3000/users?order={"createdAt":"DESC"}

# Select specific fields
GET http://localhost:3000/users?select=["id","email","firstName","lastName"]
```

#### Get Single User

```bash
GET http://localhost:3000/users/1
```

#### Create User

```bash
POST http://localhost:3000/users
Content-Type: application/json

{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "password123",
  "role": "user",
  "isActive": true
}
```

#### Update User

```bash
PATCH http://localhost:3000/users/1
Content-Type: application/json

{
  "firstName": "Jane",
  "isActive": false
}
```

#### Delete User

```bash
DELETE http://localhost:3000/users/1
```

#### Custom Endpoints

```bash
# Get active users
GET http://localhost:3000/users/active

# Get users by role
GET http://localhost:3000/users/role/admin

# Get user by email
GET http://localhost:3000/users/email/john@example.com
```

### Posts API

#### Get All Posts

```bash
# Get all posts
GET http://localhost:3000/posts

# Get posts with pagination
GET http://localhost:3000/posts?skip=0&take=10

# Get posts with author
GET http://localhost:3000/posts?relations=["author"]

# Filter posts
GET http://localhost:3000/posts?where={"published":{"$eq":true}}

# Complex filtering
GET http://localhost:3000/posts?where={"$and":[{"published":{"$eq":true}},{"status":{"$eq":"published"}}]}

# Sort posts
GET http://localhost:3000/posts?order={"createdAt":"DESC"}

# Select specific fields
GET http://localhost:3000/posts?select=["id","title","content"]
```

#### Get Single Post

```bash
GET http://localhost:3000/posts/1
```

#### Create Post

```bash
POST http://localhost:3000/posts
Content-Type: application/json

{
  "title": "My First Post",
  "content": "This is the content of my first post",
  "status": "draft",
  "authorId": 1,
  "published": false
}
```

#### Update Post

```bash
PATCH http://localhost:3000/posts/1
Content-Type: application/json

{
  "title": "Updated Title",
  "published": true
}
```

#### Delete Post

```bash
DELETE http://localhost:3000/posts/1
```

#### Custom Endpoints

```bash
# Get published posts
GET http://localhost:3000/posts/published

# Get posts by author
GET http://localhost:3000/posts/author/1

# Get posts by status
GET http://localhost:3000/posts/status/published
```

## 🎯 Advanced Query Examples

### Filtering

```bash
# Equal
GET http://localhost:3000/users?where={"role":{"$eq":"admin"}}

# Not equal
GET http://localhost:3000/users?where={"role":{"$ne":"banned"}}

# Greater than
GET http://localhost:3000/posts?where={"viewCount":{"$gt":100}}

# Less than
GET http://localhost:3000/posts?where={"viewCount":{"$lt":1000}}

# IN operator
GET http://localhost:3000/users?where={"role":{"$in":["admin","moderator"]}}

# LIKE (case-sensitive)
GET http://localhost:3000/users?where={"email":{"$like":"%@example.com"}}

# ILIKE (case-insensitive)
GET http://localhost:3000/users?where={"firstName":{"$iLike":"%john%"}}

# IS NULL
GET http://localhost:3000/users?where={"deletedAt":{"$isNull":true}}

# Logical AND
GET http://localhost:3000/users?where={"$and":[{"isActive":{"$eq":true}},{"role":{"$eq":"admin"}}]}

# Logical OR
GET http://localhost:3000/users?where={"$or":[{"role":{"$eq":"admin"}},{"role":{"$eq":"moderator"}}]}
```

### Relations

```bash
# Load simple relation
GET http://localhost:3000/users/1?relations=["posts"]

# Load multiple relations
GET http://localhost:3000/users?relations=["posts","profile"]

# Load relation with specific fields
GET http://localhost:3000/users?relations={"posts":{"select":["id","title"]}}

# Load relation with filtering
GET http://localhost:3000/users?relations={"posts":{"where":{"published":{"$eq":true}}}}
```

### Pagination

```bash
# First page (10 items)
GET http://localhost:3000/users?skip=0&take=10

# Second page
GET http://localhost:3000/users?skip=10&take=10

# Third page
GET http://localhost:3000/users?skip=20&take=10
```

### Sorting

```bash
# Sort by one field
GET http://localhost:3000/users?order={"createdAt":"DESC"}

# Sort by multiple fields
GET http://localhost:3000/users?order={"createdAt":"DESC","email":"ASC"}
```

### Field Selection

```bash
# Select specific fields
GET http://localhost:3000/users?select=["id","email","firstName"]

# Combine with relations
GET http://localhost:3000/users?select=["id","email"]&relations={"posts":{"select":["id","title"]}}
```

## 🔧 Using with curl

### Create a User

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "password": "password123",
    "role": "user"
  }'
```

### Get All Users with Filter

```bash
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"isActive":{"$eq":true}}' \
  --data-urlencode 'relations=["posts"]' \
  --data-urlencode 'skip=0' \
  --data-urlencode 'take=10'
```

### Update a User

```bash
curl -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Updated Name"}'
```

### Delete a User

```bash
curl -X DELETE http://localhost:3000/users/1
```

## 🧪 Testing

### Run Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

## 📁 Project Structure

```
example-app/
├── src/
│   ├── database/
│   │   ├── entities/       # TypeORM entities
│   │   │   ├── user.entity.ts
│   │   │   └── post.entity.ts
│   │   ├── factories/      # Data factories for seeding
│   │   │   ├── user.factory.ts
│   │   │   └── post.factory.ts
│   │   └── seeders/        # Database seeders
│   │       ├── user.seeder.ts
│   │       └── post.seeder.ts
│   ├── users/              # User module
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.module.ts
│   ├── posts/              # Post module
│   │   ├── post.controller.ts
│   │   ├── post.service.ts
│   │   └── post.module.ts
│   ├── app.module.ts       # Main application module
│   └── main.ts            # Application entry point
├── test/                  # E2E tests
├── seeder.config.ts       # Seeder configuration
└── package.json
```

## 💡 Code Examples

### Entity Definition

```typescript
// src/database/entities/user.entity.ts
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

  @Column()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'user' })
  role: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Service Definition

```typescript
// src/users/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '@ackplus/nest-auth';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    protected repository: Repository<User>,
  ) {
    super(repository);
  }

  // Custom methods
  async findActiveUsers(): Promise<User[]> {
    return this.repository.find({
      where: { isActive: true },
      relations: ['posts'],
    });
  }
}
```

### Controller Definition

```typescript
// src/users/user.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Crud } from '@ackplus/nest-auth';
import { User } from '../database/entities/user.entity';
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

  // Custom endpoints
  @Get('active')
  async getActiveUsers(): Promise<User[]> {
    return this.service.findActiveUsers();
  }
}
```

## 🌟 Features Demonstrated

- ✅ **Automatic CRUD endpoints** - No need to write boilerplate code
- ✅ **Advanced filtering** - Support for complex where conditions
- ✅ **Relations** - Automatic loading and filtering of related entities
- ✅ **Pagination** - Built-in skip/take support
- ✅ **Field selection** - Select specific fields to return
- ✅ **Sorting** - Multi-field sorting support
- ✅ **Custom endpoints** - Easy to add custom logic
- ✅ **TypeORM integration** - Full TypeORM feature support
- ✅ **Type safety** - Full TypeScript support

## 🛠️ Development

### Available Commands

```bash
# Development
pnpm start:dev         # Start in watch mode
pnpm start:debug       # Start with debugger

# Building
pnpm build             # Build application

# Testing
pnpm test              # Run unit tests
pnpm test:watch        # Run tests in watch mode
pnpm test:cov          # Run with coverage
pnpm test:e2e          # Run E2E tests

# Seeding
pnpm seed              # Run all seeders
pnpm seed:refresh      # Drop and reseed
pnpm seed:users        # Run only user seeder
pnpm seed:watch        # Auto-reseed on changes

# Linting
pnpm lint              # Lint and fix
```

## 📖 Learn More

- [nest-auth Documentation](../../packages/nest-auth/README.md)
- [nest-auth Examples](../../packages/nest-auth/examples/)
- [nest-auth-client Documentation](../../packages/nest-auth-client/README.md)
- [nest-auth-client Frontend Examples](../../packages/nest-auth-client/examples/)

## 🐛 Troubleshooting

### Database locked error

```bash
rm database.sqlite
pnpm seed
```

### Import errors

```bash
pnpm -C ../../packages/nest-auth build
```

### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## 📝 License

MIT
