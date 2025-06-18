# Plain Chat

A minimal and playful AI chat application built with vanilla TypeScript, Convex, and Clerk.

## Development Philosophy

This project follows a unique approach that combines:

- **Vanilla Web Standards**: No heavy frameworks, pure web APIs
- **Modern Developer Experience**: TypeScript, hot reload, reactive state
- **Component Architecture**: Reusable, encapsulated UI components
- **Reactive State Management**: Signal-based reactivity similar to modern frameworks
- **Declarative Templates**: HTML-like template syntax with type safety

See the [`GUIDELINES.md`](./GUIDELINES.md) file for a very detailed description of the architectural principles and patterns.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create your environment file:

```bash
cp .env.local.example .env.local
```

Set your environment variables:

- **VITE_CONVEX_URL**: Your Convex deployment URL
- **VITE_CONVEX_HTTP_URL**: Your Convex HTTP actions URL
- **VITE_CLERK_PUBLISHABLE_KEY**: Your Clerk publishable key

### 3. Convex Setup

Deploy your Convex backend:

```bash
npx convex dev
```

The database schema and functions are pre-configured in the `convex/` directory.

### 4. Clerk Configuration

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Enable GitHub OAuth provider (optional)
3. Configure your environment variables
4. Set up JWT template for Convex integration

## Development

### Quick Start

Start the development server with hot reload:

```bash
npm run dev
```

This runs the frontend on `http://localhost:5173` with live reloading.

### Build for Production

```bash
npm run build
```

## Architecture

This application follows an opinionated vanilla web architecture:

### Frontend

- **Web Components**: Custom elements with reactive state management
- **TypeScript**: Type-safe development with modern JS features
- **Vite**: Fast development server and optimized builds
- **PostCSS-Nesting**: A Vite plugin for enhanced CSS nesting support

### Backend

- **Convex**: Serverless backend with real-time database
- **HTTP Actions**: RESTful API endpoints with Hono.js routing
- **Real-time Streaming**: Server-sent events for AI responses
- **JWT Authentication**: Secure auth via Clerk integration

### Key Features

- **Persistent Chats**: Full CRUD operations for conversations
- **AI Integration**: OpenRouter API with multiple model support
- **Smart Titles**: AI-generated chat titles for better organization

## API Endpoints

All API endpoints are implemented as Convex HTTP actions:

### Authentication

- `GET /auth/status` - Check user authentication status

### AI Settings

- `GET /ai-settings/has-key` - Check if user has API key configured
- `GET /ai-settings/key-status` - Get API key validation status
- `POST /ai-settings/test-key` - Test API key validity
- `POST /ai-settings/key` - Set/update API key
- `GET /ai-settings/preferences` - Get user preferences
- `POST /ai-settings/preferences` - Update user preferences

### Chats

- `GET /chats` - Get all user chats
- `POST /chats` - Create new chat
- `DELETE /chats/:chatId` - Delete chat
- `POST /chats/:chatId/title` - Update chat title
- `POST /chats/:chatId/generate-title` - AI-generate chat title

### Messages

- `GET /chats/:chatId/messages` - Get chat messages
- `POST /chats/:chatId/messages` - Send new message
- `POST /chats/:chatId/stream` - Stream AI response

### Usage Tracking (Currently Hidden in App)

- `GET /usage/summary` - Get usage statistics
- `GET /usage/daily` - Get daily usage breakdown
- `GET /usage/monthly` - Get monthly usage breakdown

## Project Structure

```
src/
├── components/          # Reusable web components
│   ├── ChatInput.ts    # Message input component
│   ├── ChatMain.ts     # Main chat interface
│   ├── ChatMessages.ts # Message display component
│   ├── ChatSidebar.ts  # Chat navigation sidebar
│   ├── ChatSettings.ts # AI model configuration
│   ├── UsageDashboard.ts # Usage statistics display
│   └── ...
├── stores/             # Global state management
│   └── AuthStore.ts    # Authentication state
├── services/           # Business logic services
│   └── titleGenerationService.ts
├── workers/            # Web workers
│   └── titleGenerator.worker.ts
├── App.ts             # Main application component
└── main.ts            # Application entry point

convex/
├── schema.ts          # Database schema definition
├── auth.config.ts     # Clerk authentication config
├── chats.ts          # Chat management functions
├── messages.ts       # Message management functions
├── aiKeys.ts         # API key management
├── usage.ts          # Usage tracking functions
├── aiStreaming.ts    # Real-time streaming logic
├── cryptoActions.ts  # Secure server actions
├── http.ts           # HTTP action router
├── httpActions/      # Individual HTTP endpoints
└── lib/              # Shared backend utilities

lib/
├── ui/               # UI framework primitives
│   ├── Component.ts  # Base web component class
│   ├── signal.ts     # Reactive state management
│   ├── html.ts       # Template rendering
│   └── ...
├── auth/             # Authentication services
└── config.ts         # Application configuration
```
