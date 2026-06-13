# Admin Console UI - Build Guide

Beautiful Tailwind CSS admin dashboard for `@ackplus/nest-auth`

> 📚 **Full documentation: [ack-solutions.github.io/nest-auth](https://ack-solutions.github.io/nest-auth/)**

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd packages/nest-auth/src/lib/admin-console/ui
npm install
```

### 2. Development Mode (with Hot Reload)

```bash
npm run dev
```

This will start the Vite dev server at `http://localhost:5173` with hot module reloading.

### 3. Build for Production

```bash
npm run build
```

This will:
- Compile TypeScript
- Build React app with Vite
- Output bundled files to `../static/` folder:
  - `../static/index.html` (main entry)
  - `../static/assets/app.js` (bundled JS)

## 📦 Build Output

```plaintext
packages/nest-auth/src/lib/admin-console/static/
├── index.html           # Built HTML entry point
├── styles.css           # Existing CSS (not overwritten)
└── assets/
    └── app.js          # Bundled React application
```

## 🔧 Integration with nest-auth Package

### Option 1: Manual Build

```bash
# Step 1: Build UI
cd packages/nest-auth/src/lib/admin-console/ui
npm install
npm run build

# Step 2: Build nest-auth package
cd ../../../..  # back to nest-auth root
npm run build
```

### Option 2: Add to nest-auth Build Script

Edit `packages/nest-auth/package.json`:

```json
{
  "scripts": {
    "build:ui": "cd src/lib/admin-console/ui && npm install && npm run build",
    "prebuild": "npm run build:ui",
    "build": "tsc && your-existing-build-command"
  }
}
```

Now `npm run build` will automatically build the UI first.

### Option 3: Using Nx (if in Nx workspace)

Add to `packages/nest-auth/project.json`:

```json
{
  "targets": {
    "build-ui": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "packages/nest-auth/src/lib/admin-console/ui",
        "commands": [
          "npm install",
          "npm run build"
        ]
      }
    },
    "build": {
      "dependsOn": ["build-ui"],
      // ... your existing build config
    }
  }
}
```

## 🛠️ Development Workflow

### Local Development

```bash
# Terminal 1: Run UI dev server
cd packages/nest-auth/src/lib/admin-console/ui
npm run dev

# Terminal 2: Run your NestJS backend
cd packages/nest-examples  # or your app
npm run start:dev
```

Then:
- UI dev server: <http://localhost:5173>
- Backend API: <http://localhost:3000>

### Configuring API Base URL in Dev Mode

When running the dev server in watch mode, you can configure the API base URL using the `VITE_API_BASE_URL` environment variable. Create a `.env` file in the `ui` directory:

```bash
# .env
VITE_API_BASE_URL=http://localhost:3000
```

This sets the origin (protocol + host + port), and the default path `/api/auth/admin` will be appended automatically.

**Priority order:**
1. Server-injected config (production) - highest priority
2. `VITE_API_BASE_URL` (origin only) + default path - for dev mode
3. Current window origin + default path (fallback)

**Note:** After creating or modifying `.env`, restart the dev server for changes to take effect.

For production testing:

```bash
# Build UI
cd packages/nest-auth/src/lib/admin-console/ui
npm run build

# Start backend (serves built UI from static folder)
cd packages/nest-examples
npm run start:dev

# Visit: http://localhost:3000/auth/admin
```

## 📋 Available Scripts

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## 🎯 What Gets Built

### Dependencies Bundled

- React & React DOM
- React Router DOM
- Lucide React (icons)
- Recharts (charts)
- All your components and pages

### Output Size (approximate)

- `app.js`: ~150-200KB (minified + gzipped)
- `index.html`: ~2KB
- Total: ~150-202KB

## 🔍 Troubleshooting

### Build Fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### TypeScript Errors

```bash
# Check TypeScript configuration
npx tsc --noEmit
```

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

### Build Output Not Working

Make sure the Vite config outputs to the correct location:

```typescript
// vite.config.ts
build: {
  outDir: '../static',  // Must point to static folder
  emptyOutDir: false,   // Don't delete styles.css
}
```

## 🎨 Tech Stack

- **React 18** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 3** - Styling
- **Vite 5** - Build tool (super fast!)
- **Recharts 2** - Charts & data visualization
- **Lucide React** - Beautiful icons

## 📁 Project Structure

```plaintext
ui/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   ├── services/       # API service layer
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript interfaces
│   ├── app.tsx         # Main app
│   ├── main.tsx        # Entry point
│   └── index.css       # Tailwind imports
├── package.json        # Dependencies & scripts
├── vite.config.ts      # Vite configuration
├── tailwind.config.js  # Tailwind theme
├── tsconfig.json       # TypeScript config
└── index.html          # HTML template
```

## ✨ Features

- 📊 Dashboard with statistics & charts
- 👥 User management
- 🛡️ Role & permission management
- 🏢 Multi-tenant support
- 👨‍💼 Admin management
- 📚 API documentation
- 🎨 Beautiful Tailwind UI
- 📱 Fully responsive
- ⚡ Lightning fast (Vite)

## 🔗 How It Works

1. **Development**: Vite dev server runs on port 5173
2. **Build**: Compiles to `../static/` folder
3. **Production**: NestJS serves files from `static/` folder
4. **API**: SPA calls backend at `/auth/admin/api/*`

## 📝 Notes

- The `styles.css` in static folder is NOT overwritten by build
- Build output goes to `../static/` relative to UI folder
- Hot reload works in dev mode for instant updates
- TypeScript ensures type safety throughout

## 🆘 Need Help?

Check these files:
- `vite.config.ts` - Build configuration
- `tailwind.config.js` - Theme customization
- `tsconfig.json` - TypeScript settings
- `src/services/api.ts` - API client setup

---

**Ready to build?** Run these commands:

```bash
cd packages/nest-auth/src/lib/admin-console/ui
npm install
npm run build
```

That's it! Your beautiful admin console is ready to use! 🎉
