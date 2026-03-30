# CommNode

A real-time communication platform with WebSocket messaging, friend management, and OAuth authentication.

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
6. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and Client Secret

Add to `apps/server/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### OAuth Flow

1. User clicks "Sign in with Google" → redirected to `/auth/google`
2. After Google consent → callback to `/auth/google/callback`
3. **Returning users** (complete profile): Redirected to frontend with access token
4. **New users**: Redirected to `/register/google?token=xyz` to complete profile (username, display name)

## Client Pages

The frontend includes authentication pages with Traditional Chinese interface:

### Authentication Routes

| Route              | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `/login`           | Login page with Google OAuth and email/password           |
| `/register`        | Registration page with Google OAuth and email form        |
| `/register/google` | Profile setup after Google OAuth (username, display name) |
| `/auth/success`    | OAuth callback handler, stores token and redirects        |

### Client Environment

Copy the example environment file:

```bash
cp apps/client/.env.example apps/client/.env.local
```

Configuration:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Docker

### Development (with hot-reload)

```bash
# Start all services (postgres, pgadmin, server, client)
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop services
docker compose -f docker-compose.dev.yml down
```

**Services:**

| Service  | URL                   | Description            |
| -------- | --------------------- | ---------------------- |
| Client   | http://localhost:3001 | Next.js frontend       |
| Server   | http://localhost:3000 | Express API            |
| pgAdmin  | http://localhost:5050 | Database management    |
| Postgres | localhost:5432        | PostgreSQL 18.3 Alpine |

**pgAdmin credentials:** `admin@localhost.com` / `admin`

### Production

```bash
# Create .env file with required variables
cat > .env << EOF
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-at-least-32-characters
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
CORS_ORIGIN=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
EOF

# Build and start
docker compose up -d --build

# Run database migrations
docker compose exec server npx prisma migrate deploy

# View logs
docker compose logs -f
```

### Environment Variables

**Required for production:**

| Variable            | Description                  |
| ------------------- | ---------------------------- |
| `POSTGRES_PASSWORD` | PostgreSQL password          |
| `JWT_SECRET`        | JWT signing secret (32+ chars) |

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
