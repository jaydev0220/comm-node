# CommNode

A real-time communication platform with WebSocket messaging, friend management, OAuth authentication, and real-time notification pushes for friend requests and new messages.

## Tech Stack

- **Runtime:** Node.js 24
- **Frontend:** Next.js 16, Tailwind CSS 4
- **Backend:** Express 5, Prisma 7
- **Database:** PostgreSQL 18
- **Language:** TypeScript 5
- **Validation:** Zod 4
- **Package Manager:** pnpm 10+

## Project Structure

```
root/
  ├── apps/
  │     ├── client/           # Next.js frontend
  │     └── server/           # Express + WebSocket server
  ├── packages/
  │     ├── schemas/          # Zod schemas + types
  │     └── prettier-config/  # Shared Prettier config
  ├── docs/                   # Documentation
  └── pnpm-workspace.yaml     # Workspace settings
```

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL 18+ (or use Docker)
- Docker & Docker Compose (optional)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/server/.env.example apps/server/.env
# Edit .env with your database URL and secrets

# Run database migrations
pnpm --filter @apps/server db:migrate:dev

# Start development servers
pnpm dev
```

## Google OAuth Setup

To enable Google OAuth login:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application** as application type
6. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
7. Copy the Client ID and Client Secret

Add to `apps/server/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

### OAuth Flow

1. User clicks "Sign in with Google" → redirected to `/api/auth/google`
2. After Google consent → callback to `/api/auth/google/callback`
3. **Returning users** (complete profile): Redirected to frontend with access token
4. **New users**: Redirected to `/register/google?token=xyz`, then forwarded to `/register/setup?flow=google&token=xyz` to complete profile (username, display name, optional avatar upload)

### Email Registration Flow

1. User submits email + password to `/api/auth/register/start`
2. Backend returns setup token and frontend redirects to `/register/setup?flow=email&token=xyz`
3. User completes profile (username, display name, optional avatar upload)
4. Frontend submits setup data to `/api/auth/register/complete`

## Client Pages

The frontend includes authentication pages with Traditional Chinese interface:

### Authentication Routes

| Route              | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `/login`           | Login page with Google OAuth and email/password           |
| `/register`        | Registration step 1: email + password only                |
| `/register/google` | Google OAuth transition page (redirects to shared setup page) |
| `/register/setup`  | Shared profile setup for email and Google registration (username, display name, optional avatar upload) |
| `/auth/success`    | OAuth callback handler, stores token and redirects        |

### Client Environment

Copy the example environment file:

```bash
cp apps/client/.env.example apps/client/.env.local
```

Configuration:

```env
# Backend server origin (the client automatically appends /api)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Docker

```bash
# Create .env from template
cp .env.example .env
# Edit .env with values

# Build and start
docker compose up -d --build
# Prisma client generation + migrations run automatically on server startup

# View logs
docker compose logs -f
```

### Environment Variables

**Required for production:**

| Variable            | Description                     |
| ------------------- | ------------------------------- |
| `POSTGRES_PASSWORD` | PostgreSQL password             |
| `JWT_SECRET`        | JWT signing secret (32+ chars) |
| `GOOGLE_CLIENT_ID`  | Google OAuth client id          |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret   |

**Optional:**

| Variable               | Default               | Description             |
| ---------------------- | --------------------- | ----------------------- |
| `POSTGRES_USER`        | `postgres`            | PostgreSQL username     |
| `POSTGRES_DB`          | `comm`                | Database name           |
| `SERVER_PORT`          | `3000`                | Host port for server    |
| `CLIENT_PORT`          | `3001`                | Host port for client    |
| `JWT_ACCESS_EXPIRES_IN`| `15m`                 | Access token expiry     |
| `JWT_REFRESH_EXPIRES_IN`| `7d`                 | Refresh token expiry    |

### Troubleshooting

**Container won't start:**

```bash
# Check logs
docker compose logs server
docker compose logs client

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

**Database connection issues:**

```bash
# Verify postgres is healthy
docker compose ps

# Connect to postgres directly
docker compose exec postgres psql -U postgres -d comm
```

**Hot-reload not working (dev):**

- Ensure source files are mounted correctly
- Check that the file watcher has permissions
- On Windows/macOS, file events may have slight delays
