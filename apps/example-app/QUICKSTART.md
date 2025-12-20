# Quick Start Guide - Example App

Get the example app running in 5 minutes! 🚀

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)

## Setup Steps

### 1. Install Dependencies

```bash
# From the root directory
pnpm install
```

### 2. Build Packages

```bash
# Build both nest-auth packages
pnpm build:packages
```

### 3. Seed Database

```bash
# Navigate to example app
cd apps/example-app

# Seed the database with test data
pnpm seed
```

This will create:
- 10 test users
- 30 test posts

### 4. Start the Server

```bash
# Start in development mode
pnpm start:dev
```

You should see:
```
🚀 Application is running on: http://localhost:3000
📚 Swagger documentation: http://localhost:3000/api
```

### 5. Open Swagger UI

Open your browser and go to: **http://localhost:3000/api**

## Testing the API

### Using Swagger UI (Recommended)

1. Go to http://localhost:3000/api
2. Click on any endpoint to expand it
3. Click "Try it out"
4. Fill in parameters (if needed)
5. Click "Execute"
6. See the response!

### Example Endpoints to Try

#### Get All Users
- Endpoint: `GET /users`
- Try it: http://localhost:3000/api#/users/UserController_findAll

#### Get All Posts
- Endpoint: `GET /posts`
- Try it: http://localhost:3000/api#/posts/PostController_findAll

#### Get Active Users
- Endpoint: `GET /users/active`
- Try it: http://localhost:3000/api#/users/UserController_getActiveUsers

#### Get Published Posts
- Endpoint: `GET /posts/published`
- Try it: http://localhost:3000/api#/posts/PostController_getPublishedPosts

## Advanced Queries

### Pagination

In Swagger, try adding these query parameters to `GET /users`:
- `skip`: 0
- `take`: 5

### Filtering

Add this to the `where` parameter:
```json
{"isActive":{"$eq":true}}
```

### Relations

Add this to the `relations` parameter:
```json
["posts"]
```

### Sorting

Add this to the `order` parameter:
```json
{"createdAt":"DESC"}
```

## Using with curl

If you prefer command line:

```bash
# Get all users
curl http://localhost:3000/users

# Get active users
curl http://localhost:3000/users/active

# Get users with pagination
curl "http://localhost:3000/users?skip=0&take=5"

# Get users with filter
curl -G http://localhost:3000/users \
  --data-urlencode 'where={"isActive":{"$eq":true}}'

# Create a user
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

## Troubleshooting

### Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database locked

```bash
# Remove and recreate database
rm database.sqlite
pnpm seed
```

### Package build errors

```bash
# Clean and rebuild
cd ../../
pnpm build:packages
cd apps/example-app
pnpm start:dev
```

## Next Steps

- ✅ Explore all endpoints in Swagger UI
- ✅ Try different filters and query parameters
- ✅ Create, update, and delete entities
- ✅ Test relations between users and posts
- ✅ Experiment with advanced queries

## Need Help?

- Check the [main README](./README.md) for detailed API documentation
- Look at [nest-auth documentation](../../packages/nest-auth/README.md)
- Check [nest-auth-js examples](../../packages/nest-auth-js/examples/)

Happy coding! 🎉

