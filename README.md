# Plain Chat

A modern AI chat application built with TypeScript, Hono, Convex, and Clerk authentication.

## Features

- 🔐 Authentication with Clerk
- 💬 Real-time chat interface
- 🗄️ Data persistence with Convex
- 🎨 Modern vanilla TypeScript web components
- 📱 Responsive design

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

1. Copy the environment template:

```bash
cp .env.local.example .env.local
```

2. Fill in your environment variables:
   - **Convex URL**: Get this from your Convex dashboard
   - **Clerk Keys**: Get these from your Clerk dashboard
   - **Port**: Server port (default: 3000)

### 3. Convex Setup

1. Initialize Convex (if not already done):

```bash
npx convex dev
```

2. The schema and functions are already configured in the `convex/` directory.

### 4. Clerk Setup

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Update the publishable key in `src/App.ts` (line 54)
3. Configure your environment variables

## Development

### Development Workflow

**✅ Recommended: Separate Development Servers**

1. **Start the backend server** (for API endpoints):

```bash
npm run dev:server
```

This runs on `http://localhost:3000` and provides API endpoints.

2. **Start the frontend server** (for development with hot reload):

```bash
npm run dev
```

This runs on `http://localhost:5173` with hot reload and fast development.

3. **Access your app**: Open `http://localhost:5173` in your browser.

The frontend automatically makes API calls to the backend server during development.

**Alternative: Production-like Testing**

First build the frontend:

```bash
npm run build
```

Then run the full-stack server:

```bash
NODE_ENV=production npm start
```

This serves everything on `http://localhost:3000`

### Development URLs

- **🎯 Main App (development)**: `http://localhost:5173`
- **⚙️ Backend API**: `http://localhost:3000/api/*`
- **📊 Backend Status**: `http://localhost:3000` (shows helpful info page)
- **🚀 Production**: `http://localhost:3000` (after build)

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Architecture

- **Frontend**: Vanilla TypeScript with custom web components
- **Backend**: Hono.js server with Clerk authentication
- **Database**: Convex for real-time data synchronization
- **Authentication**: Clerk for user management

## API Endpoints

- `GET /api/auth/status` - Check authentication status
- `GET /api/messages` - Get chat messages (authenticated)
- `GET /*` - Serve SPA for all other routes

## File Structure

```
src/
├── components/    # Web components
├── lib/           # Utilities and base classes
├── App.ts         # Main application component
└── main.ts        # Entry point

convex/
├── schema.ts      # Database schema
├── chats.ts       # Chat management functions
├── messages.ts    # Message management functions
├── aiKeys.ts      # AI key management functions
├── cryptoActions.ts # Secure server actions
└── usage.ts       # Usage tracking functions

server.js          # Hono server
```

## Notes

- The app uses a custom web component architecture (no Shadow DOM)
- Messages are stored in Convex as "tasks" with role and content
- Authentication state is managed through Clerk
- The server serves the SPA and provides API endpoints
