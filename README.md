# @ackplus/nest-auth

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Powerful CRUD operations and query building for NestJS and frontend applications</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/v/@ackplus/nest-auth.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/l/@ackplus/nest-auth.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@ackplus/nest-auth"><img src="https://img.shields.io/npm/dm/@ackplus/nest-auth.svg" alt="NPM Downloads" /></a>
</p>

## 📦 Packages

This monorepo contains two complementary packages:

### [@ackplus/nest-auth](./packages/nest-auth) - Backend CRUD Operations

Automatic REST API endpoints with advanced filtering, relations, and pagination for NestJS + TypeORM.

**Key Features:**
- 🚀 **Automatic CRUD endpoints** - No boilerplate code
- 🔍 **Advanced filtering** - Complex where conditions with multiple operators
- 🔗 **Relations handling** - Automatic loading and filtering
- 📄 **Pagination** - Built-in skip/take support
- 🎯 **Field selection** - Select specific fields to return
- 📚 **Swagger integration** - Automatic API documentation

### [@ackplus/nest-auth-client](./packages/nest-auth-client) - Query Builder

Framework-agnostic query builder for REST APIs - works in React, Angular, Vue, and any JavaScript/TypeScript environment.

**Key Features:**
- 🎯 **Framework-agnostic** - Works anywhere
- 🌐 **Frontend & Backend** - Use in any environment
- 🔍 **Type-safe** - Full TypeScript support
- 🔗 **Fluent API** - Chainable methods
- 📦 **Zero dependencies** - Lightweight
- 🔄 **Flexible output** - Query string, JSON, or object

## 🚀 Quick Start

### Backend (NestJS)

```bash
npm install @ackplus/nest-auth
```

```typescript
// user.controller.ts
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

**Result:** Full REST API with filtering, pagination, relations, and more! ✨

```bash
GET    /users              # List all users
GET    /users/:id          # Get single user
POST   /users              # Create user
PATCH  /users/:id          # Update user
DELETE /users/:id          # Delete user
```

[📖 Full Backend Documentation](./packages/nest-auth/README.md)

### Frontend (React, Angular, Vue, etc.)

```bash
npm install @ackplus/nest-auth-client
```

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';

// Build complex queries
const query = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .andWhere('role', WhereOperatorEnum.IN, ['admin', 'moderator'])
  .addRelation('posts', ['id', 'title'])
  .setSkip(0)
  .setTake(10)
  .addOrder('createdAt', OrderDirectionEnum.DESC);

// Convert to query parameters
const params = query.toObject();

// Use with any HTTP client
const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
```

[📖 Full Frontend Documentation](./packages/nest-auth-client/README.md)

## 📚 Documentation

### Package Documentation

- **[@ackplus/nest-auth](./packages/nest-auth/README.md)** - Backend CRUD operations for NestJS
  - [Examples](./packages/nest-auth/examples/) - Backend examples
- **[@ackplus/nest-auth-client](./packages/nest-auth-client/README.md)** - Frontend query builder
  - [React Examples](./packages/nest-auth-client/examples/react/) - React integration
  - [Angular Examples](./packages/nest-auth-client/examples/angular/) - Angular integration
  - [Vue Examples](./packages/nest-auth-client/examples/vue/) - Vue integration

### Example Application

See a complete working example:
- **[Example App](./apps/example-app/)** - Full-stack example with NestJS + TypeORM + SQLite
- API with User and Post entities
- Comprehensive query examples
- Database seeding
- Tests

## 🎯 Features

### Backend Features (nest-auth)

```typescript
// Automatic endpoints with all features:

// Advanced filtering
GET /users?where={"isActive":{"$eq":true},"role":{"$in":["admin","moderator"]}}

// Relations
GET /users?relations={"posts":{"select":["id","title"],"where":{"published":{"$eq":true}}}}

// Pagination
GET /users?skip=0&take=10

// Sorting
GET /users?order={"createdAt":"DESC","email":"ASC"}

// Field selection
GET /users?select=["id","email","firstName"]

// Combine everything
GET /users?where={"isActive":{"$eq":true}}&relations=["posts"]&skip=0&take=10&order={"createdAt":"DESC"}
```

### Frontend Features (nest-auth-client)

```typescript
// Fluent API for building queries

// Simple query
const query = new QueryBuilder()
  .where('email', 'john@example.com')
  .toObject();

// Complex query
const query = new QueryBuilder()
  .where((builder) => {
    builder
      .where('email', WhereOperatorEnum.ILIKE, '%@example.com')
      .orWhere('firstName', WhereOperatorEnum.ILIKE, '%john%');
  })
  .addRelation('posts')
  .setSkip(0)
  .setTake(20)
  .addOrder('createdAt', OrderDirectionEnum.DESC)
  .toObject();

// Use with any framework
const params = new URLSearchParams(query);
const users = await axios.get(`/api/users?${params}`);
```

## 🔧 Query Operators

Both packages support these operators:

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
| `$like` | Like (case-sensitive) | `{"email":{"$like":"%@gmail.com"}}` |
| `$iLike` | Like (case-insensitive) | `{"name":{"$iLike":"%john%"}}` |
| `$isNull` | Is null | `{"deletedAt":{"$isNull":true}}` |
| `$isNotNull` | Is not null | `{"deletedAt":{"$isNotNull":true}}` |
| `$between` | Between | `{"age":{"$between":[18,65]}}` |
| `$and` | Logical AND | `{"$and":[{...},{...}]}` |
| `$or` | Logical OR | `{"$or":[{...},{...}]}` |

## 🛠️ Development

### Setup

```bash
# Clone repository
git clone https://github.com/ackplus/nest-auth.git
cd nest-auth

# Install dependencies
pnpm install

# Build packages
pnpm build:packages
```

### Project Structure

```
nest-auth/
├── packages/
│   ├── nest-auth/              # Backend CRUD package
│   │   ├── src/                  # Source code
│   │   ├── examples/             # Backend examples
│   │   └── README.md             # Package documentation
│   └── nest-auth-client/      # Frontend query builder
│       ├── src/                  # Source code
│       ├── examples/             # Frontend examples (React, Angular, Vue)
│       └── README.md             # Package documentation
├── apps/
│   └── example-app/            # Full-stack example
│       ├── src/
│       │   ├── users/            # User CRUD module
│       │   ├── posts/            # Post CRUD module
│       │   └── database/         # Entities, seeders
│       └── README.md             # Example documentation
├── scripts/
│   └── publish.js              # Publishing script
└── package.json                # Root workspace
```

### Development Workflow

```bash
# Build all packages
pnpm build:packages

# Build specific package
pnpm -C packages/nest-auth build
pnpm -C packages/nest-auth-client build

# Run example app
cd apps/example-app
pnpm seed                       # Seed database
pnpm start:dev                  # Start API server

# Run tests
pnpm -C packages/nest-auth test
pnpm -C packages/nest-auth-client test
pnpm -C apps/example-app test
```

## 🧪 Testing

```bash
# Test all packages
pnpm test

# Test specific package
pnpm -C packages/nest-auth test
pnpm -C packages/nest-auth-client test

# Test with coverage
pnpm -C packages/nest-auth test:cov
```

## 📖 Examples

### Backend Example (NestJS)

```typescript
// Complete CRUD setup in 3 files

// 1. Entity
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @OneToMany(() => Post, post => post.author)
  posts: Post[];
}

// 2. Service
@Injectable()
export class UserService extends CrudService<User> {
  constructor(
    @InjectRepository(User)
    protected repository: Repository<User>,
  ) {
    super(repository);
  }
}

// 3. Controller
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

### Frontend Example (React)

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';

function UserList() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      const query = new QueryBuilder()
        .where('isActive', WhereOperatorEnum.EQ, true)
        .addRelation('posts')
        .setSkip(page * 10)
        .setTake(10)
        .addOrder('createdAt', OrderDirectionEnum.DESC);

      const params = query.toObject();
      const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
      const data = await response.json();
      setUsers(data);
    };

    fetchUsers();
  }, [page]);

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.email}</div>
      ))}
    </div>
  );
}
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Build and test (`pnpm build:packages && pnpm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

MIT License

## 🔗 Links

- **NPM Packages:**
  - [@ackplus/nest-auth](https://www.npmjs.com/package/@ackplus/nest-auth)
  - [@ackplus/nest-auth-client](https://www.npmjs.com/package/@ackplus/nest-auth-client)
- **[GitHub Repository](https://github.com/ackplus/nest-auth)**
- **[Issue Tracker](https://github.com/ackplus/nest-auth/issues)**

---

Made with ❤️ for the NestJS and frontend communities
