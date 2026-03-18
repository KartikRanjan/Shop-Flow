# Base Backend - Enterprise Node.js Starter

Base Backend is a high-performance, scalable enterprise-grade starter template built with Node.js, Express, and TypeScript. It leverages Drizzle ORM for database management and follows a clean, modular architecture for maintainability and type safety.

## 🚀 Tech Stack

- **Runtime:** Node.js (v20+)
- **Framework:** Express.js (v5)
- **Language:** TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Task Queue:** Redis & BullMQ
- **Validation:** Zod
- **Authentication:** JWT (Access & Refresh tokens) with Argon2 hashing
- **Documentation:** Swagger / OpenAPI 3.0 (via xpress-toolkit)
- **Logging:** Pino & Morgan
- **Testing:** Jest & Supertest

## 🛠️ Prerequisites

- **Node.js** (LTS version recommended)
- **npm** or **pnpm**
- **PostgreSQL** instance
- **Redis** instance (for BullMQ queues)

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd base-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Key configurations include:

- `DATABASE_URL`: Your PostgreSQL connection string.
- `REDIS_HOST`/`PORT`: Your Redis configuration.
- `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`: Secure keys for token signing.

### 4. Database Setup

Generate and apply migrations to your database:

```bash
# Generate SQL migrations from schema
npm run db:generate

# Apply migrations to the database
npm run db:migrate
```

### 5. Seed Initial Data

Seed the initial admin user to get started:

```bash
npm run seed:admin
```

_Note: Check `scripts/seed-admin.ts` for default credentials._

## 🏃 Running the Application

### Development Mode

Runs the server with hot-reload using `tsx`:

```bash
npm run dev
```

### Production Build

Compile TypeScript to JavaScript and start the server:

```bash
npm run build
npm start
```

## 📚 API Documentation

Once the server is running, you can access the interactive Swagger documentation at:
`http://localhost:3000/api-docs`

The project uses `xpress-toolkit` for a code-first OpenAPI approach.

## 🧪 Testing & Quality

### Running Tests

Execute the test suite using Jest:

```bash
npm test
```

### Linting & Formatting

The project uses ESLint and Prettier for code quality. These are enforced via Husky pre-commit hooks.

```bash
# Run linter
npm run lint

# Fix linting issues and format code
npm run lint:fix
npm run format
```

## 📂 Project Structure

```text
├── src/
│   ├── config/             # Environment & app configurations
│   ├── constants/          # Application constants & enums
│   ├── errors/             # Custom error classes (AppError, NotFound, etc.)
│   ├── infrastructure/     # Database (schema/repos), Logger, Swagger setup
│   ├── middlewares/        # Auth, Error handling, Validation middlewares
│   ├── modules/            # Business logic (Modular structure)
│   │   ├── auth/           # Login, Register, Refresh Token
│   │   └── users/          # Profile management, Admin user routes
│   ├── routes/             # Main API router registry
│   ├── types/              # Global & shared TypeScript declarations
│   └── utils/              # API Response, JWT, and other utilities
├── drizzle/                # Database migrations & snapshots
├── scripts/                # Utility & seeding scripts
└── tests/                  # Integration & unit tests
```

## 📦 Database Management

We use **Drizzle Studio** to explore and manage database records through a GUI:

```bash
npm run db:studio
```

---

Built for scalable and maintainable backend systems.
