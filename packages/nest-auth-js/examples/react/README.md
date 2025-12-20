# React Examples

Examples of using `@ackplus/nest-auth-js` with React.

## Table of Contents

1. [Basic Usage with Hooks](#basic-usage-with-hooks)
2. [Custom Hook for Query Builder](#custom-hook-for-query-builder)
3. [Search Component](#search-component)
4. [Pagination Component](#pagination-component)
5. [Advanced Filtering](#advanced-filtering)
6. [Type-Safe API Client](#type-safe-api-client)

## Basic Usage with Hooks

```tsx
// UserList.tsx
import { useState, useEffect } from 'react';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      
      const query = new QueryBuilder()
        .where('isActive', WhereOperatorEnum.EQ, true)
        .setSkip(page * pageSize)
        .setTake(pageSize)
        .addOrder('createdAt', OrderDirectionEnum.DESC);

      const params = query.toObject();
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/users?${queryString}`);
      const data = await response.json();
      
      setUsers(data);
      setLoading(false);
    };

    fetchUsers();
  }, [page]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.firstName} {user.lastName} - {user.email}
          </li>
        ))}
      </ul>
      <button 
        onClick={() => setPage(p => Math.max(0, p - 1))} 
        disabled={page === 0}
      >
        Previous
      </button>
      <span>Page {page + 1}</span>
      <button onClick={() => setPage(p => p + 1)}>
        Next
      </button>
    </div>
  );
}
```

## Custom Hook for Query Builder

```tsx
// hooks/useQueryBuilder.ts
import { useState, useCallback, useMemo } from 'react';
import { QueryBuilder, QueryBuilderOptions } from '@ackplus/nest-auth-js';

export function useQueryBuilder(initialOptions?: QueryBuilderOptions) {
  const [options, setOptions] = useState<QueryBuilderOptions>(initialOptions || {});

  const queryBuilder = useMemo(() => {
    return new QueryBuilder(options);
  }, [options]);

  const updateOptions = useCallback((newOptions: Partial<QueryBuilderOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  }, []);

  const reset = useCallback(() => {
    setOptions(initialOptions || {});
  }, [initialOptions]);

  const toQueryString = useCallback(() => {
    const params = queryBuilder.toObject();
    return new URLSearchParams(params).toString();
  }, [queryBuilder]);

  return {
    queryBuilder,
    options,
    updateOptions,
    reset,
    toQueryString,
  };
}
```

### Using the Custom Hook

```tsx
// UserListWithHook.tsx
import { useState, useEffect } from 'react';
import { WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { useQueryBuilder } from './hooks/useQueryBuilder';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export function UserListWithHook() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { queryBuilder, updateOptions, toQueryString } = useQueryBuilder({
    skip: 0,
    take: 10,
  });

  const fetchUsers = async () => {
    setLoading(true);
    const response = await fetch(`/api/users?${toQueryString()}`);
    const data = await response.json();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [toQueryString]);

  const goToNextPage = () => {
    const currentSkip = queryBuilder.options.skip || 0;
    const take = queryBuilder.options.take || 10;
    updateOptions({ skip: currentSkip + take });
  };

  const goToPreviousPage = () => {
    const currentSkip = queryBuilder.options.skip || 0;
    const take = queryBuilder.options.take || 10;
    updateOptions({ skip: Math.max(0, currentSkip - take) });
  };

  return (
    <div>
      <h1>Users</h1>
      {loading && <div>Loading...</div>}
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.firstName} {user.lastName} - {user.email}
          </li>
        ))}
      </ul>
      <button onClick={goToPreviousPage}>Previous</button>
      <button onClick={goToNextPage}>Next</button>
    </div>
  );
}
```

## Search Component

```tsx
// SearchableUserList.tsx
import { useState, useEffect, useCallback } from 'react';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { debounce } from 'lodash'; // or implement your own debounce

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export function SearchableUserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async (search: string) => {
    setLoading(true);

    const query = new QueryBuilder();

    if (search) {
      // Search across multiple fields
      query.where((builder) => {
        builder
          .where('email', WhereOperatorEnum.ILIKE, `%${search}%`)
          .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${search}%`)
          .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${search}%`);
      });
    }

    query.addOrder('email', OrderDirectionEnum.ASC).setTake(50);

    const params = query.toObject();
    const queryString = new URLSearchParams(params).toString();

    const response = await fetch(`/api/users?${queryString}`);
    const data = await response.json();

    setUsers(data);
    setLoading(false);
  };

  // Debounce search to avoid too many API calls
  const debouncedSearch = useCallback(
    debounce((search: string) => {
      fetchUsers(search);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  return (
    <div>
      <h1>Search Users</h1>
      <input
        type="text"
        placeholder="Search by email or name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {loading && <div>Searching...</div>}
      <ul>
        {users.map(user => (
          <li key={user.id}>
            {user.firstName} {user.lastName} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Pagination Component

```tsx
// components/PaginatedList.tsx
import { useState, useEffect } from 'react';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';

interface PaginatedListProps<T> {
  endpoint: string;
  pageSize?: number;
  renderItem: (item: T) => React.ReactNode;
  filters?: Record<string, any>;
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
}

export function PaginatedList<T extends { id: number }>({
  endpoint,
  pageSize = 10,
  renderItem,
  filters,
  orderBy,
}: PaginatedListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);

      const query = new QueryBuilder()
        .setSkip(page * pageSize)
        .setTake(pageSize);

      if (filters) {
        query.where(filters);
      }

      if (orderBy) {
        query.addOrder(
          orderBy.field,
          orderBy.direction as OrderDirectionEnum
        );
      }

      const params = query.toObject();
      const queryString = new URLSearchParams(params).toString();

      const response = await fetch(`${endpoint}?${queryString}`);
      const data = await response.json();

      setItems(data);
      setHasMore(data.length === pageSize);
      setLoading(false);
    };

    fetchItems();
  }, [endpoint, page, pageSize, filters, orderBy]);

  return (
    <div>
      {loading && <div>Loading...</div>}
      <ul>
        {items.map(item => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
      <div>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Using the Pagination Component

```tsx
// App.tsx
import { PaginatedList } from './components/PaginatedList';
import { WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export function App() {
  return (
    <div>
      <h1>Active Users</h1>
      <PaginatedList<User>
        endpoint="/api/users"
        pageSize={20}
        filters={{ isActive: { [WhereOperatorEnum.EQ]: true } }}
        orderBy={{ field: 'createdAt', direction: 'DESC' }}
        renderItem={(user) => (
          <div>
            {user.firstName} {user.lastName} - {user.email}
          </div>
        )}
      />
    </div>
  );
}
```

## Advanced Filtering

```tsx
// AdvancedUserFilter.tsx
import { useState, useEffect } from 'react';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface FilterState {
  search: string;
  role: string;
  isActive: boolean | null;
  dateFrom: string;
  dateTo: string;
}

export function AdvancedUserFilter() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    role: '',
    isActive: null,
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);

      const query = new QueryBuilder();

      // Search filter
      if (filters.search) {
        query.where((builder) => {
          builder
            .where('email', WhereOperatorEnum.ILIKE, `%${filters.search}%`)
            .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${filters.search}%`)
            .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${filters.search}%`);
        });
      }

      // Role filter
      if (filters.role) {
        query.andWhere('role', WhereOperatorEnum.EQ, filters.role);
      }

      // Active status filter
      if (filters.isActive !== null) {
        query.andWhere('isActive', WhereOperatorEnum.EQ, filters.isActive);
      }

      // Date range filter
      if (filters.dateFrom && filters.dateTo) {
        query.andWhere('createdAt', WhereOperatorEnum.BETWEEN, [
          filters.dateFrom,
          filters.dateTo,
        ]);
      } else if (filters.dateFrom) {
        query.andWhere('createdAt', WhereOperatorEnum.GT_OR_EQ, filters.dateFrom);
      } else if (filters.dateTo) {
        query.andWhere('createdAt', WhereOperatorEnum.LT_OR_EQ, filters.dateTo);
      }

      query.addOrder('createdAt', OrderDirectionEnum.DESC).setTake(50);

      const params = query.toObject();
      const queryString = new URLSearchParams(params).toString();

      const response = await fetch(`/api/users?${queryString}`);
      const data = await response.json();

      setUsers(data);
      setLoading(false);
    };

    fetchUsers();
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      search: '',
      role: '',
      isActive: null,
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <div>
      <h1>Advanced User Filter</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />

        <select
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
        </select>

        <select
          value={filters.isActive === null ? '' : String(filters.isActive)}
          onChange={(e) =>
            setFilters({
              ...filters,
              isActive: e.target.value === '' ? null : e.target.value === 'true',
            })
          }
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          placeholder="From Date"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          placeholder="To Date"
        />

        <button onClick={resetFilters}>Reset Filters</button>
      </div>

      {loading && <div>Loading...</div>}

      <div>
        <h2>Results: {users.length}</h2>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.firstName} {user.lastName} - {user.email} - {user.role} -{' '}
              {user.isActive ? 'Active' : 'Inactive'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## Type-Safe API Client

```tsx
// api/client.ts
import { QueryBuilder, QueryBuilderOptions } from '@ackplus/nest-auth-js';

export class ApiClient {
  constructor(private baseUrl: string = '/api') {}

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async find<T>(
    resource: string,
    options?: QueryBuilderOptions
  ): Promise<T[]> {
    const query = new QueryBuilder(options);
    const params = query.toObject();
    const queryString = new URLSearchParams(params).toString();
    
    return this.request<T[]>(`/${resource}?${queryString}`);
  }

  async findOne<T>(resource: string, id: number | string): Promise<T> {
    return this.request<T>(`/${resource}/${id}`);
  }

  async create<T>(resource: string, data: Partial<T>): Promise<T> {
    return this.request<T>(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update<T>(
    resource: string,
    id: number | string,
    data: Partial<T>
  ): Promise<T> {
    return this.request<T>(`/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(resource: string, id: number | string): Promise<void> {
    await this.request<void>(`/${resource}/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
```

### Using the API Client

```tsx
// hooks/useUsers.ts
import { useState, useEffect } from 'react';
import { WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { apiClient } from '../api/client';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async (filters?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.find<User>('users', {
        where: filters,
        order: { createdAt: OrderDirectionEnum.DESC },
        take: 50,
      });
      setUsers(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: Partial<User>) => {
    const newUser = await apiClient.create<User>('users', userData);
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const updateUser = async (id: number, userData: Partial<User>) => {
    const updatedUser = await apiClient.update<User>('users', id, userData);
    setUsers(prev =>
      prev.map(user => (user.id === id ? updatedUser : user))
    );
    return updatedUser;
  };

  const deleteUser = async (id: number) => {
    await apiClient.delete('users', id);
    setUsers(prev => prev.filter(user => user.id !== id));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}
```

## Best Practices

1. **Memoize query builders** - Use `useMemo` to avoid unnecessary re-renders
2. **Debounce search inputs** - Prevent excessive API calls
3. **Type your data** - Use TypeScript interfaces for type safety
4. **Error handling** - Always handle API errors gracefully
5. **Loading states** - Show loading indicators during data fetching
6. **Pagination** - Always paginate large datasets
7. **Caching** - Consider using React Query or SWR for caching

## Additional Resources

- [React Query Integration](./react-query.md)
- [SWR Integration](./swr.md)
- [Redux Integration](./redux.md)

