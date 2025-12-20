# Angular Examples

Examples of using `@ackplus/nest-auth-js` with Angular.

## Table of Contents

1. [Service Setup](#service-setup)
2. [Component with Pagination](#component-with-pagination)
3. [Search Component](#search-component)
4. [Advanced Filtering Service](#advanced-filtering-service)
5. [Reactive Forms Integration](#reactive-forms-integration)

## Service Setup

```typescript
// services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum, QueryBuilderOptions } from '@ackplus/nest-auth-js';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

  findAll(options?: QueryBuilderOptions): Observable<User[]> {
    const query = new QueryBuilder(options);
    const params = query.toObject();
    return this.http.get<User[]>(this.apiUrl, { params });
  }

  findOne(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(user: Partial<User>): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  update(id: number, user: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, user);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Helper methods for common queries
  findActiveUsers(): Observable<User[]> {
    return this.findAll({
      where: { isActive: { $eq: true } },
      order: { createdAt: OrderDirectionEnum.DESC },
    });
  }

  findByRole(role: string): Observable<User[]> {
    return this.findAll({
      where: { role: { $eq: role } },
    });
  }

  searchUsers(searchTerm: string): Observable<User[]> {
    const query = new QueryBuilder();
    
    query.where((builder) => {
      builder
        .where('email', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
        .orWhere('firstName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`)
        .orWhere('lastName', WhereOperatorEnum.ILIKE, `%${searchTerm}%`);
    });

    const params = query.toObject();
    return this.http.get<User[]>(this.apiUrl, { params });
  }
}
```

## Component with Pagination

```typescript
// components/user-list/user-list.component.ts
import { Component, OnInit } from '@angular/core';
import { UserService, User } from '../../services/user.service';
import { OrderDirectionEnum } from '@ackplus/nest-auth-js';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  loading = false;
  page = 0;
  pageSize = 10;
  hasMore = true;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;

    this.userService.findAll({
      skip: this.page * this.pageSize,
      take: this.pageSize,
      order: { createdAt: OrderDirectionEnum.DESC },
    }).subscribe({
      next: (users) => {
        this.users = users;
        this.hasMore = users.length === this.pageSize;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  nextPage(): void {
    this.page++;
    this.loadUsers();
  }

  previousPage(): void {
    if (this.page > 0) {
      this.page--;
      this.loadUsers();
    }
  }
}
```

```html
<!-- components/user-list/user-list.component.html -->
<div class="user-list">
  <h1>Users</h1>

  <div *ngIf="loading">Loading...</div>

  <table *ngIf="!loading">
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
      <tr *ngFor="let user of users">
        <td>{{ user.id }}</td>
        <td>{{ user.email }}</td>
        <td>{{ user.firstName }} {{ user.lastName }}</td>
        <td>{{ user.role }}</td>
        <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
      </tr>
    </tbody>
  </table>

  <div class="pagination">
    <button 
      (click)="previousPage()" 
      [disabled]="page === 0 || loading"
    >
      Previous
    </button>
    <span>Page {{ page + 1 }}</span>
    <button 
      (click)="nextPage()" 
      [disabled]="!hasMore || loading"
    >
      Next
    </button>
  </div>
</div>
```

## Search Component

```typescript
// components/user-search/user-search.component.ts
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { UserService, User } from '../../services/user.service';

@Component({
  selector: 'app-user-search',
  templateUrl: './user-search.component.html',
  styleUrls: ['./user-search.component.css']
})
export class UserSearchComponent implements OnInit {
  searchControl = new FormControl('');
  users: User[] = [];
  loading = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(searchTerm => {
          this.loading = true;
          return this.userService.searchUsers(searchTerm || '');
        })
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.loading = false;
        },
        error: (error) => {
          console.error('Search error:', error);
          this.loading = false;
        }
      });
  }
}
```

```html
<!-- components/user-search/user-search.component.html -->
<div class="user-search">
  <h1>Search Users</h1>

  <input
    type="text"
    [formControl]="searchControl"
    placeholder="Search by email or name..."
  />

  <div *ngIf="loading">Searching...</div>

  <ul *ngIf="!loading">
    <li *ngFor="let user of users">
      {{ user.firstName }} {{ user.lastName }} - {{ user.email }}
    </li>
  </ul>
</div>
```

## Advanced Filtering Service

```typescript
// services/user-filter.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { QueryBuilder, WhereOperatorEnum, OrderDirectionEnum } from '@ackplus/nest-auth-js';
import { UserService, User } from './user.service';

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserFilterService {
  private filtersSubject = new BehaviorSubject<UserFilters>({});
  public filters$ = this.filtersSubject.asObservable();

  public users$: Observable<User[]>;

  constructor(private userService: UserService) {
    this.users$ = this.filters$.pipe(
      switchMap(filters => this.fetchUsers(filters))
    );
  }

  updateFilters(filters: Partial<UserFilters>): void {
    this.filtersSubject.next({
      ...this.filtersSubject.value,
      ...filters
    });
  }

  resetFilters(): void {
    this.filtersSubject.next({});
  }

  private fetchUsers(filters: UserFilters): Observable<User[]> {
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
    if (filters.isActive !== undefined) {
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

    query.addOrder('createdAt', OrderDirectionEnum.DESC).setTake(100);

    const params = query.toObject();
    return this.userService.findAll(params);
  }
}
```

## Reactive Forms Integration

```typescript
// components/advanced-user-filter/advanced-user-filter.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { UserFilterService, UserFilters } from '../../services/user-filter.service';
import { User } from '../../services/user.service';

@Component({
  selector: 'app-advanced-user-filter',
  templateUrl: './advanced-user-filter.component.html',
  styleUrls: ['./advanced-user-filter.component.css']
})
export class AdvancedUserFilterComponent implements OnInit {
  filterForm: FormGroup;
  users: User[] = [];
  loading = false;

  roles = ['admin', 'user', 'moderator'];

  constructor(
    private fb: FormBuilder,
    private userFilterService: UserFilterService
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      role: [''],
      isActive: [null],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  ngOnInit(): void {
    // Update filters when form changes
    this.filterForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe((filters: UserFilters) => {
        this.userFilterService.updateFilters(filters);
      });

    // Subscribe to filtered users
    this.userFilterService.users$.subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      search: '',
      role: '',
      isActive: null,
      dateFrom: '',
      dateTo: ''
    });
    this.userFilterService.resetFilters();
  }
}
```

```html
<!-- components/advanced-user-filter/advanced-user-filter.component.html -->
<div class="advanced-filter">
  <h1>Advanced User Filter</h1>

  <form [formGroup]="filterForm">
    <div class="form-row">
      <input
        type="text"
        formControlName="search"
        placeholder="Search..."
      />

      <select formControlName="role">
        <option value="">All Roles</option>
        <option *ngFor="let role of roles" [value]="role">
          {{ role }}
        </option>
      </select>

      <select formControlName="isActive">
        <option [ngValue]="null">All Status</option>
        <option [ngValue]="true">Active</option>
        <option [ngValue]="false">Inactive</option>
      </select>

      <input
        type="date"
        formControlName="dateFrom"
        placeholder="From Date"
      />

      <input
        type="date"
        formControlName="dateTo"
        placeholder="To Date"
      />

      <button type="button" (click)="resetFilters()">
        Reset Filters
      </button>
    </div>
  </form>

  <div *ngIf="loading">Loading...</div>

  <div *ngIf="!loading">
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
        <tr *ngFor="let user of users">
          <td>{{ user.email }}</td>
          <td>{{ user.firstName }} {{ user.lastName }}</td>
          <td>{{ user.role }}</td>
          <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
          <td>{{ user.createdAt | date }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

## Module Configuration

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { UserListComponent } from './components/user-list/user-list.component';
import { UserSearchComponent } from './components/user-search/user-search.component';
import { AdvancedUserFilterComponent } from './components/advanced-user-filter/advanced-user-filter.component';

@NgModule({
  declarations: [
    AppComponent,
    UserListComponent,
    UserSearchComponent,
    AdvancedUserFilterComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

## Best Practices

1. **Service layer** - Keep all API logic in services
2. **RxJS operators** - Use debounceTime, distinctUntilChanged, switchMap for search
3. **Type safety** - Define interfaces for all data models
4. **Error handling** - Always handle errors in subscriptions
5. **Unsubscribe** - Use takeUntil or async pipe to prevent memory leaks
6. **Loading states** - Show loading indicators during API calls
7. **Form validation** - Validate user input before sending to API

## Additional Resources

- [NgRx Integration](./ngrx.md)
- [Interceptors for Auth](./interceptors.md)

