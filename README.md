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
- PostgreSQL 18+

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