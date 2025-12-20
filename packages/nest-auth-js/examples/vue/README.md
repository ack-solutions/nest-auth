# Vue 3 Examples

Examples of using `@ackplus/nest-auth-js` with Vue 3 and Composition API.

## Table of Contents

1. [Composable Setup](#composable-setup)
2. [Component with Pagination](#component-with-pagination)
3. [Search Component](#search-component)
4. [Advanced Filtering](#advanced-filtering)
5. [Pinia Store Integration](#pinia-store-integration)

## Composable Setup

```typescript
// composables/useUsers.ts
import { ref, computed } from 'vue';
import axios from 'axios';
import { QueryBuilder, QueryBuilderOptions, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

export function useUsers() {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchUsers = async (options?: QueryBuilderOptions) => {
    loading.value = true;
    error.value = null;

    try {
      const query = new QueryBuilder(options);
      const params = query.toObject();

      const response = await axios.get<User[]>('/api/users', { params });
      users.value = response.data;
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  };

  const findOne = async (id: number): Promise<User | null> => {
    try {
      const response = await axios.get<User>(`/api/users/${id}`);
      return response.data;
    } catch (err) {
      error.value = err as Error;
      return null;
    }
  };

  const create = async (userData: Partial<User>): Promise<User | null> => {
    try {
      const response = await axios.post<User>('/api/users', userData);
      users.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = err as Error;
      return null;
    }
  };

  const update = async (id: number, userData: Partial<User>): Promise<User | null> => {
    try {
      const response = await axios.patch<User>(`/api/users/${id}`, userData);
      const index = users.value.findIndex(u => u.id === id);
      if (index !== -1) {
        users.value[index] = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err as Error;
      return null;
    }
  };

  const remove = async (id: number): Promise<boolean> => {
    try {
      await axios.delete(`/api/users/${id}`);
      users.value = users.value.filter(u => u.id !== id);
      return true;
    } catch (err) {
      error.value = err as Error;
      return false;
    }
  };

  const searchUsers = async (searchTerm: string) => {
    const query = new QueryBuilder();

    if (searchTerm) {
      query.where((builder) => {
        builder
          .where('email', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
          .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
          .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`);
      });
    }

    query.addOrder('email', OrderDirectionEnum.ASC);

    await fetchUsers(query.toObject(true));
  };

  return {
    users: computed(() => users.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchUsers,
    findOne,
    create,
    update,
    remove,
    searchUsers,
  };
}
```

## Component with Pagination

```vue
<!-- components/UserList.vue -->
<template>
  <div class="user-list">
    <h1>Users</h1>

    <div v-if="loading">Loading...</div>
    <div v-if="error">Error: {{ error.message }}</div>

    <table v-if="!loading && !error">
      <thead>
        <tr>
          <th>ID</th>
          <th>Email</th>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.firstName }} {{ user.lastName }}</td>
          <td>{{ user.role }}</td>
          <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button @click="previousPage" :disabled="page === 0 || loading">
        Previous
      </button>
      <span>Page {{ page + 1 }}</span>
      <button @click="nextPage" :disabled="!hasMore || loading">
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { useUsers } from '../composables/useUsers';

const { users, loading, error, fetchUsers } = useUsers();

const page = ref(0);
const pageSize = 10;
const hasMore = ref(true);

const loadUsers = async () => {
  await fetchUsers({
    skip: page.value * pageSize,
    take: pageSize,
    order: { createdAt: OrderDirectionEnum.DESC },
  });

  hasMore.value = users.value.length === pageSize;
};

const nextPage = () => {
  page.value++;
};

const previousPage = () => {
  if (page.value > 0) {
    page.value--;
  }
};

watch(page, loadUsers);

onMounted(loadUsers);
</script>

<style scoped>
.user-list {
  padding: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.pagination {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

## Search Component

```vue
<!-- components/UserSearch.vue -->
<template>
  <div class="user-search">
    <h1>Search Users</h1>

    <input
      v-model="searchTerm"
      type="text"
      placeholder="Search by email or name..."
      @input="onSearchInput"
    />

    <div v-if="loading">Searching...</div>

    <ul v-if="!loading">
      <li v-for="user in users" :key="user.id">
        {{ user.firstName }} {{ user.lastName }} - {{ user.email }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDebounceFn } from '@vueuse/core'; // or implement your own debounce
import { useUsers } from '../composables/useUsers';

const { users, loading, searchUsers } = useUsers();

const searchTerm = ref('');

const debouncedSearch = useDebounceFn(async (term: string) => {
  await searchUsers(term);
}, 300);

const onSearchInput = () => {
  debouncedSearch(searchTerm.value);
};
</script>

<style scoped>
.user-search {
  padding: 20px;
}

input {
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  font-size: 16px;
}

ul {
  list-style: none;
  padding: 0;
}

li {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}
</style>
```

## Advanced Filtering

```vue
<!-- components/AdvancedUserFilter.vue -->
<template>
  <div class="advanced-filter">
    <h1>Advanced User Filter</h1>

    <div class="filters">
      <input
        v-model="filters.search"
        type="text"
        placeholder="Search..."
      />

      <select v-model="filters.role">
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
        <option value="moderator">Moderator</option>
      </select>

      <select v-model="filters.isActive">
        <option :value="null">All Status</option>
        <option :value="true">Active</option>
        <option :value="false">Inactive</option>
      </select>

      <input
        v-model="filters.dateFrom"
        type="date"
        placeholder="From Date"
      />

      <input
        v-model="filters.dateTo"
        type="date"
        placeholder="To Date"
      />

      <button @click="resetFilters">Reset Filters</button>
    </div>

    <div v-if="loading">Loading...</div>

    <div v-if="!loading">
      <h2>Results: {{ users.length }}</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.email }}</td>
            <td>{{ user.firstName }} {{ user.lastName }}</td>
            <td>{{ user.role }}</td>
            <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
            <td>{{ new Date(user.createdAt).toLocaleDateString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { useUsers } from '../composables/useUsers';
import { useDebounceFn } from '@vueuse/core';

const { users, loading, fetchUsers } = useUsers();

const filters = reactive({
  search: '',
  role: '',
  isActive: null as boolean | null,
  dateFrom: '',
  dateTo: '',
});

const buildQuery = () => {
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

  return query.toObject(true);
};

const debouncedFetch = useDebounceFn(async () => {
  await fetchUsers(buildQuery());
}, 300);

watch(filters, debouncedFetch);

const resetFilters = () => {
  filters.search = '';
  filters.role = '';
  filters.isActive = null;
  filters.dateFrom = '';
  filters.dateTo = '';
};
</script>

<style scoped>
.advanced-filter {
  padding: 20px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters input,
.filters select {
  padding: 8px;
  font-size: 14px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}
</style>
```

## Pinia Store Integration

```typescript
// stores/userStore.ts
import { defineStore } from 'pinia';
import axios from 'axios';
import { QueryBuilder, QueryBuilderOptions, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import type { User } from '../composables/useUsers';

export const useUserStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    loading: false,
    error: null as Error | null,
    filters: {
      search: '',
      role: '',
      isActive: null as boolean | null,
    },
  }),

  getters: {
    activeUsers: (state) => state.users.filter(u => u.isActive),
    usersByRole: (state) => (role: string) =>
      state.users.filter(u => u.role === role),
  },

  actions: {
    async fetchUsers(options?: QueryBuilderOptions) {
      this.loading = true;
      this.error = null;

      try {
        const query = new QueryBuilder(options);
        const params = query.toObject();

        const response = await axios.get<User[]>('/api/users', { params });
        this.users = response.data;
      } catch (err) {
        this.error = err as Error;
      } finally {
        this.loading = false;
      }
    },

    async fetchWithFilters() {
      const query = new QueryBuilder();

      if (this.filters.search) {
        query.where((builder) => {
          builder
            .where('email', WhereOperatorEnum.ILIKE, `%${this.filters.search}%`)
            .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${this.filters.search}%`)
            .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${this.filters.search}%`);
        });
      }

      if (this.filters.role) {
        query.andWhere('role', WhereOperatorEnum.EQ, this.filters.role);
      }

      if (this.filters.isActive !== null) {
        query.andWhere('isActive', WhereOperatorEnum.EQ, this.filters.isActive);
      }

      query.addOrder('createdAt', OrderDirectionEnum.DESC);

      await this.fetchUsers(query.toObject(true));
    },

    async createUser(userData: Partial<User>) {
      try {
        const response = await axios.post<User>('/api/users', userData);
        this.users.push(response.data);
        return response.data;
      } catch (err) {
        this.error = err as Error;
        return null;
      }
    },

    async updateUser(id: number, userData: Partial<User>) {
      try {
        const response = await axios.patch<User>(`/api/users/${id}`, userData);
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = response.data;
        }
        return response.data;
      } catch (err) {
        this.error = err as Error;
        return null;
      }
    },

    async deleteUser(id: number) {
      try {
        await axios.delete(`/api/users/${id}`);
        this.users = this.users.filter(u => u.id !== id);
        return true;
      } catch (err) {
        this.error = err as Error;
        return false;
      }
    },

    updateFilters(newFilters: Partial<typeof this.filters>) {
      this.filters = { ...this.filters, ...newFilters };
      this.fetchWithFilters();
    },

    resetFilters() {
      this.filters = {
        search: '',
        role: '',
        isActive: null,
      };
      this.fetchUsers();
    },
  },
});
```

### Using the Pinia Store

```vue
<!-- components/UserListWithStore.vue -->
<template>
  <div class="user-list">
    <h1>Users (Pinia Store)</h1>

    <div class="filters">
      <input
        :value="store.filters.search"
        @input="updateSearch"
        placeholder="Search..."
      />
      
      <select
        :value="store.filters.role"
        @change="updateRole"
      >
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>

      <button @click="store.resetFilters()">Reset</button>
    </div>

    <div v-if="store.loading">Loading...</div>

    <ul v-if="!store.loading">
      <li v-for="user in store.users" :key="user.id">
        {{ user.firstName }} {{ user.lastName }} - {{ user.email }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useUserStore } from '../stores/userStore';

const store = useUserStore();

const updateSearch = (e: Event) => {
  const target = e.target as HTMLInputElement;
  store.updateFilters({ search: target.value });
};

const updateRole = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  store.updateFilters({ role: target.value });
};

onMounted(() => {
  store.fetchUsers();
});
</script>
```

## Best Practices

1. **Composables** - Use composables for reusable logic
2. **Debouncing** - Debounce search inputs to prevent excessive API calls
3. **Type safety** - Define TypeScript interfaces for all data
4. **Error handling** - Always handle errors gracefully
5. **Loading states** - Show loading indicators during API calls
6. **State management** - Use Pinia for complex state management
7. **Watchers** - Use watchers for reactive filtering

## Additional Resources

- [VueUse Integration](./vueuse.md)
- [TypeScript Best Practices](./typescript.md)

