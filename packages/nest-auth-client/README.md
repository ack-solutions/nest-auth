# @ackplus/nest-auth-client

Framework-agnostic query builder for REST APIs - build complex queries with filtering, relations, and pagination for both frontend and backend.

## Features

- 🎯 **Framework-agnostic** - Works with any JavaScript/TypeScript framework
- 🌐 **Frontend & Backend** - Use in React, Angular, Vue, Node.js, or any other environment
- 🔍 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🔗 **Fluent API** - Chainable methods for building complex queries
- 📦 **Zero dependencies** - Lightweight with minimal footprint
- 🎨 **Clean syntax** - Intuitive and readable query construction
- 🔄 **Flexible output** - Export as query string, JSON, or object

## Installation

```bash
npm install @ackplus/nest-auth-client
# or
pnpm add @ackplus/nest-auth-client
# or
yarn add @ackplus/nest-auth-client
```

## Quick Start

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';

// Create a query builder
const query = new QueryBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .andWhere('role', WhereOperatorEnum.IN, ['admin', 'moderator'])
  .addRelation('posts', ['id', 'title'])
  .setSkip(0)
  .setTake(10)
  .addOrder('createdAt', OrderDirectionEnum.DESC);

// Convert to query string parameters
const params = query.toObject();
// {
//   where: '{"isActive":{"$eq":true},"$and":[{"role":{"$in":["admin","moderator"]}}]}',
//   relations: '{"posts":{"select":["id","title"]}}',
//   skip: 0,
//   take: 10,
//   order: '{"createdAt":"DESC"}'
// }

// Use with fetch or axios
const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
```

## Usage Examples

### Frontend Usage (React)

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';
import { useState, useEffect } from 'react';

function UserList() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const fetchUsers = async () => {
      const query = new QueryBuilder()
        .where('isActive', WhereOperatorEnum.EQ, true)
        .addRelation('posts')
        .setSkip(page * pageSize)
        .setTake(pageSize)
        .addOrder('createdAt', OrderDirectionEnum.DESC);

      const params = query.toObject();
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/users?${queryString}`);
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
      <button onClick={() => setPage(page - 1)} disabled={page === 0}>
        Previous
      </button>
      <button onClick={() => setPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
```

### Frontend Usage (Angular)

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class UserService {
  constructor(private http: HttpClient) {}

  getUsers(page: number = 0, pageSize: number = 10): Observable<User[]> {
    const query = new QueryBuilder()
      .where('isActive', WhereOperatorEnum.EQ, true)
      .addRelation('posts')
      .setSkip(page * pageSize)
      .setTake(pageSize)
      .addOrder('createdAt', OrderDirectionEnum.DESC);

    const params = query.toObject();
    
    return this.http.get<User[]>('/api/users', { params });
  }

  searchUsers(searchTerm: string): Observable<User[]> {
    const query = new QueryBuilder()
      .where((builder) => {
        builder
          .where('email', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
          .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
          .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`);
      })
      .addOrder('email', OrderDirectionEnum.ASC);

    const params = query.toObject();
    
    return this.http.get<User[]>('/api/users', { params });
  }
}
```

### Frontend Usage (Vue 3)

```typescript
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-client';
import { ref, onMounted } from 'vue';
import axios from 'axios';

export function useUsers() {
  const users = ref([]);
  const loading = ref(false);
  const page = ref(0);
  const pageSize = 10;

  const fetchUsers = async () => {
    loading.value = true;
    
    const query = new QueryBuilder()
      .where('isActive', WhereOperatorEnum.EQ, true)
      .addRelation('posts')
      .setSkip(page.value * pageSize)
      .setTake(pageSize)
      .addOrder('createdAt', OrderDirectionEnum.DESC);

    const params = query.toObject();
    
    const response = await axios.get('/api/users', { params });
    users.value = response.data;
    loading.value = false;
  };

  const searchUsers = async (searchTerm: string) => {
    const query = new QueryBuilder()
      .where((builder) => {
        builder
          .where('email', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
          .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`);
      });

    const params = query.toObject();
    const response = await axios.get('/api/users', { params });
    users.value = response.data;
  };

  onMounted(fetchUsers);

  return {
    users,
    loading,
    page,
    fetchUsers,
    searchUsers,
  };
}
```

### Backend Usage (Node.js/Express)

```typescript
import { QueryBuilder, WhereOperatorEnum } from '@ackplus/nest-auth-client';

// Parse query from request
app.get('/api/users', (req, res) => {
  // Build query from request params
  const query = new QueryBuilder({
    where: req.query.where,
    relations: req.query.relations,
    select: req.query.select,
    skip: req.query.skip ? parseInt(req.query.skip) : 0,
    take: req.query.take ? parseInt(req.query.take) : 10,
    order: req.query.order,
  });

  // Use the query to fetch data from database
  // ... your database logic
});
```

## API Reference

### QueryBuilder

#### Constructor

```typescript
new QueryBuilder(options?: QueryBuilderOptions)
```

#### Methods

##### `setOptions(options: QueryBuilderOptions): this`

Set all options at once.

```typescript
query.setOptions({
  where: { isActive: { $eq: true } },
  relations: ['posts'],
  skip: 0,
  take: 10,
});
```

##### `mergeOptions(options: QueryBuilderOptions, deep?: boolean): this`

Merge options with existing options.

```typescript
query.mergeOptions({
  skip: 10,
  take: 20,
});
```

##### `addSelect(fields: string | string[]): this`

Add fields to select.

```typescript
query.addSelect(['id', 'email', 'firstName']);
query.addSelect('lastName');
```

##### `removeSelect(fields: string | string[]): this`

Remove fields from select.

```typescript
query.removeSelect(['password', 'secretKey']);
```

##### `addRelation(relation: string, select?: string[], where?: Record<string, any>): this`

Add a relation to load.

```typescript
// Simple relation
query.addRelation('posts');

// Relation with specific fields
query.addRelation('posts', ['id', 'title', 'content']);

// Relation with filter
query.addRelation('posts', ['id', 'title'], {
  published: { $eq: true }
});
```

##### `removeRelation(relation: string): this`

Remove a relation.

```typescript
query.removeRelation('posts');
```

##### `where(...args: WhereBuilderCondition): this`

Set where condition (replaces existing).

```typescript
// Simple equality
query.where('email', 'john@example.com');

// With operator
query.where('age', WhereOperatorEnum.GT, 18);

// Object syntax
query.where({ isActive: { $eq: true } });

// Function syntax for complex conditions
query.where((builder) => {
  builder
    .where('role', WhereOperatorEnum.EQ, 'admin')
    .orWhere('role', WhereOperatorEnum.EQ, 'moderator');
});
```

##### `andWhere(...args: WhereBuilderCondition): this`

Add an AND where condition.

```typescript
query.where('isActive', WhereOperatorEnum.EQ, true)
     .andWhere('role', WhereOperatorEnum.EQ, 'admin');
```

##### `orWhere(...args: WhereBuilderCondition): this`

Add an OR where condition.

```typescript
query.where('role', WhereOperatorEnum.EQ, 'admin')
     .orWhere('role', WhereOperatorEnum.EQ, 'moderator');
```

##### `addOrder(orderBy: string, order: OrderDirectionEnum): this`

Add an order clause.

```typescript
query.addOrder('createdAt', OrderDirectionEnum.DESC);
query.addOrder('email', OrderDirectionEnum.ASC);
```

##### `removeOrder(orderBy: string): this`

Remove an order clause.

```typescript
query.removeOrder('createdAt');
```

##### `setSkip(skip: number): this`

Set the skip (offset) value.

```typescript
query.setSkip(10);
```

##### `setTake(take: number): this`

Set the take (limit) value.

```typescript
query.setTake(10);
```

##### `setWithDeleted(withDeleted: boolean): this`

Include soft-deleted records.

```typescript
query.setWithDeleted(true);
```

##### `setOnlyDeleted(onlyDeleted: boolean): this`

Only show soft-deleted records.

```typescript
query.setOnlyDeleted(true);
```

##### `set(key: string, value: any): this`

Set a custom option.

```typescript
query.set('customField', 'customValue');
```

##### `toObject(constrainToNestedObject?: boolean): QueryBuilderOptions`

Convert to object (suitable for query parameters).

```typescript
const params = query.toObject();
// By default, nested objects are converted to JSON strings
// {
//   where: '{"isActive":{"$eq":true}}',
//   relations: '["posts"]',
//   skip: 0,
//   take: 10
// }

// Keep nested objects as objects
const paramsNested = query.toObject(true);
// {
//   where: { isActive: { $eq: true } },
//   relations: ['posts'],
//   skip: 0,
//   take: 10
// }
```

##### `toJson(): string`

Convert to JSON string.

```typescript
const json = query.toJson();
// '{"where":{"isActive":{"$eq":true}},"relations":["posts"],"skip":0,"take":10}'
```

### WhereBuilder

The WhereBuilder is used internally by QueryBuilder but can also be used standalone.

```typescript
import { WhereBuilder, WhereOperatorEnum } from '@ackplus/nest-auth-client';

const whereBuilder = new WhereBuilder()
  .where('isActive', WhereOperatorEnum.EQ, true)
  .andWhere('role', WhereOperatorEnum.IN, ['admin', 'moderator']);

const whereObject = whereBuilder.toObject();
const whereJson = whereBuilder.toJson();
```

### Operators

```typescript
enum WhereOperatorEnum {
  EQ = '$eq',              // Equal
  NOT_EQ = '$ne',          // Not equal
  GT = '$gt',              // Greater than
  GT_OR_EQ = '$gte',       // Greater than or equal
  LT = '$lt',              // Less than
  LT_OR_EQ = '$lte',       // Less than or equal
  IN = '$in',              // In array
  NOT_IN = '$notIn',       // Not in array
  LIKE = '$like',          // Like (case-sensitive)
  NOT_LIKE = '$notLike',   // Not like
  ILIKE = '$iLike',        // Like (case-insensitive)
  NOT_ILIKE = '$notIlike', // Not like (case-insensitive)
  IS_NULL = '$isNull',     // Is null
  IS_NOT_NULL = '$isNotNull', // Is not null
  BETWEEN = '$between',    // Between
  NOT_BETWEEN = '$notBetween', // Not between
  IS_TRUE = '$isTrue',     // Is true
  IS_FALSE = '$isFalse',   // Is false
}
```

### Order Direction

```typescript
enum OrderDirectionEnum {
  ASC = 'ASC',
  DESC = 'DESC',
}
```

## Advanced Examples

### Complex Filtering

```typescript
const query = new QueryBuilder()
  .where((builder) => {
    builder
      .where('isActive', WhereOperatorEnum.EQ, true)
      .andWhere((subBuilder) => {
        subBuilder
          .where('role', WhereOperatorEnum.EQ, 'admin')
          .orWhere('role', WhereOperatorEnum.EQ, 'moderator');
      })
      .andWhere('age', WhereOperatorEnum.BETWEEN, [18, 65]);
  });

// Results in:
// {
//   isActive: { $eq: true },
//   $and: [
//     {
//       $or: [
//         { role: { $eq: 'admin' } },
//         { role: { $eq: 'moderator' } }
//       ]
//     },
//     { age: { $between: [18, 65] } }
//   ]
// }
```

### Search Functionality

```typescript
function buildSearchQuery(searchTerm: string) {
  return new QueryBuilder()
    .where((builder) => {
      builder
        .where('email', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
        .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
        .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`);
    })
    .addOrder('email', OrderDirectionEnum.ASC);
}

// Usage
const searchQuery = buildSearchQuery('john');
const params = searchQuery.toObject();
```

### Pagination Helper

```typescript
function buildPaginatedQuery(page: number, pageSize: number = 10) {
  return new QueryBuilder()
    .setSkip(page * pageSize)
    .setTake(pageSize);
}

// Usage
const paginatedQuery = buildPaginatedQuery(2, 20); // Page 3, 20 items per page
```

### Reusable Query Builder

```typescript
class UserQueryBuilder {
  private builder: QueryBuilder;

  constructor() {
    this.builder = new QueryBuilder();
  }

  activeUsers() {
    this.builder.andWhere('isActive', WhereOperatorEnum.EQ, true);
    return this;
  }

  admins() {
    this.builder.andWhere('role', WhereOperatorEnum.EQ, 'admin');
    return this;
  }

  withPosts() {
    this.builder.addRelation('posts', ['id', 'title', 'createdAt']);
    return this;
  }

  paginate(page: number, pageSize: number = 10) {
    this.builder.setSkip(page * pageSize).setTake(pageSize);
    return this;
  }

  orderByNewest() {
    this.builder.addOrder('createdAt', OrderDirectionEnum.DESC);
    return this;
  }

  build() {
    return this.builder.toObject();
  }
}

// Usage
const params = new UserQueryBuilder()
  .activeUsers()
  .admins()
  .withPosts()
  .paginate(0, 10)
  .orderByNewest()
  .build();
```

### Dynamic Filters

```typescript
interface FilterOptions {
  search?: string;
  role?: string;
  isActive?: boolean;
  minAge?: number;
  maxAge?: number;
}

function buildDynamicQuery(filters: FilterOptions) {
  const query = new QueryBuilder();

  if (filters.search) {
    query.where((builder) => {
      builder
        .where('email', WhereOperatorEnum.ILIKE, `%${filters.search}%`)
        .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${filters.search}%`)
        .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${filters.search}%`);
    });
  }

  if (filters.role) {
    query.andWhere('role', WhereOperatorEnum.EQ, filters.role);
  }

  if (filters.isActive !== undefined) {
    query.andWhere('isActive', WhereOperatorEnum.EQ, filters.isActive);
  }

  if (filters.minAge !== undefined && filters.maxAge !== undefined) {
    query.andWhere('age', WhereOperatorEnum.BETWEEN, [filters.minAge, filters.maxAge]);
  } else if (filters.minAge !== undefined) {
    query.andWhere('age', WhereOperatorEnum.GT_OR_EQ, filters.minAge);
  } else if (filters.maxAge !== undefined) {
    query.andWhere('age', WhereOperatorEnum.LT_OR_EQ, filters.maxAge);
  }

  return query;
}

// Usage
const params = buildDynamicQuery({
  search: 'john',
  role: 'admin',
  isActive: true,
  minAge: 18,
  maxAge: 65,
}).toObject();
```

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import {
  QueryBuilder,
  QueryBuilderOptions,
  WhereOperatorEnum,
  OrderDirectionEnum,
  WhereBuilder,
  WhereOptions,
  RelationOptions,
} from '@ackplus/nest-auth-client';

// Type-safe query building
const options: QueryBuilderOptions = {
  where: { isActive: { $eq: true } },
  relations: ['posts'],
  select: ['id', 'email'],
  skip: 0,
  take: 10,
  order: { createdAt: 'DESC' },
};

const query = new QueryBuilder(options);
```

## Best Practices

1. **Validate user input** - Always sanitize and validate search terms and filters from user input
2. **Set reasonable limits** - Use `setTake()` with reasonable defaults to prevent large data transfers
3. **Use select fields** - Only select fields you need to reduce payload size
4. **Reuse query builders** - Create reusable query builder classes for common patterns
5. **Type your responses** - Use TypeScript interfaces for API responses
6. **Handle errors** - Always handle network errors and invalid responses
7. **Cache when possible** - Cache query results when data doesn't change frequently
8. **Optimize relations** - Only load relations you actually need

## Framework-Specific Tips

### React

- Use `useMemo` to memoize query builders
- Create custom hooks for common queries
- Combine with React Query or SWR for caching

### Angular

- Create service classes for query building
- Use Angular's HttpClient for automatic JSON parsing
- Leverage RxJS operators for query composition

### Vue

- Use composables for query logic
- Leverage Vue's reactivity for dynamic queries
- Combine with Pinia for state management

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Packages

- [@ackplus/nest-auth](../nest-auth) - NestJS CRUD operations with TypeORM
