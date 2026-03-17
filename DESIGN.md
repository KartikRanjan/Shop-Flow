# Enterprise TypeScript Architecture & Design Document: ShopFlow (E-Commerce Platform)

This document outlines the high-level technical design for the **ShopFlow E-Commerce Platform** — an enterprise-grade TypeScript application. It emphasizes type safety, modularity, and scalability using **Express.js**.

## 1. Architectural Philosophy: "Clean Hexagonal Architecture"

The platform follows a **Hexagonal (Ports and Adapters)** approach implemented within a **Modular Architecture**. While Express is minimalist, we enforce enterprise standards through dependency injection and strict layering.

### Core Principles

1.  **Strict Type Safety:** Leveraging TypeScript's advanced type system for compile-time safety across all layers.
2.  **Dependency Inversion:** Core logic depends on abstractions. We use **Manual Dependency Injection** to manage component lifecycles and decouple implementations.
3.  **Event-Driven Evolution:** Side effects are handled asynchronously using a robust distributed task queue.
4.  **Schema-First Validation:** **Zod** defines strict boundaries for API requests and environment variables.
5.  **API Versioning:** All endpoints are versioned (e.g., `/api/v1`) to allow for non-breaking evolution of the interface.

---

## 2. Technology Stack

| Component            | Technology                | Why it was chosen                                                                                                             |
| :------------------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **Language**         | **TypeScript 5.x**        | Static typing and modern ESM support for robust backend development.                                                          |
| **Framework**        | **Express.js**            | Minimalist, flexible, and the most widely adopted Node.js framework.                                                          |
| **DI Strategy**      | **Manual Injection**      | Explicit dependency management through constructors and a centralized composition root, avoiding magic and improving clarity. |
| **ORM**              | **Drizzle ORM**           | Lightweight, type-safe SQL query builder with zero-overhead abstractions and SQL-like syntax.                                 |
| **Database**         | **PostgreSQL**            | Reliable relational storage with excellent JSONB support.                                                                     |
| **Cache / Session**  | **Redis**                 | Fast in-memory store for session revocation (blacklisting) and distributed tasks.                                             |
| **Task Queue**       | **BullMQ (Redis)**        | Professional-grade distributed task queue for retries and delayed jobs.                                                       |
| **Authentication**   | **Custom JWT middleware** | Zero-dependency token verification; no Passport.js abstraction layer needed.                                                  |
| **Hashing**          | **Argon2**                | Modern, winner of the Password Hashing Competition, superior to bcrypt.                                                       |
| **Token Management** | **jsonwebtoken**          | Industry standard for stateless session management via JWT.                                                                   |
| **Cookie Handling**  | **cookie-parser**         | Parses HTTP-only cookies for secure refresh token transport.                                                                  |
| **Validation**       | **Zod**                   | TypeScript-first schema declaration and validation.                                                                           |
| **Logging**          | **Pino**                  | High-performance, low-overhead structured logger.                                                                             |

---

## 3. System Architecture Layers

The application is structured into logical modules, each following a layered internal structure:

1.  **Presentation Layer (Adapters - Inbound):**
    - **Responsibility:** Handle HTTP requests, routing, and input validation.
    - **Components:** Routers, Controllers, Middlewares (Auth, Error Handling).
    - **Packages:** `express`, `zod`.

2.  **Application Layer (Use Cases):**
    - **Responsibility:** Orchestrate business flows. It coordinates between the Domain layer and Infrastructure adapters.
    - **Components:** Service Classes (injected into controllers).

3.  **Domain Layer (Core Logic):**
    - **Responsibility:** Pure business logic and entities.
    - **Components:** Entities, Value Objects, Domain Services.
    - **Constraint:** Zero dependencies on external frameworks or ORMs.

4.  **Infrastructure Layer (Adapters - Outbound):**
    - **Responsibility:** Implementation of persistence and external API clients.
    - **Components:** Drizzle Repositories, BullMQ Workers, Mailer implementations.
    - **Packages:** `drizzle-orm`, `bullmq`.

---

## 4. Business Modules

### 4.1 Users

Manages customer accounts, seller accounts, and admin accounts. Supports RBAC with a **roles array** (PostgreSQL ENUM array), allowing users to hold multiple roles simultaneously (e.g., `['user', 'seller']`). Roles: `user`, `seller`, `admin`.

### 4.2 Auth

JWT-based stateless authentication with **dual-token refresh rotation** — no Passport.js. Access tokens are short-lived JWTs (15 min) delivered via `Authorization: Bearer`. Refresh tokens are long-lived opaque JWTs (30 days) stored in HTTP-only cookies and rotated on every use.

**Session Management Features:**

- **Refresh Session Store:** Active sessions are stored in the `refresh_sessions` table.
- **Fast Revocation (Redis):** Logged-out or rotated sessions are cached in Redis for high-speed revocation checks in the authentication middleware.
- **Database Fallback:** PostgreSQL serves as the persistent source of truth for all sessions, providing a fallback for the revocation cache.
- **Token Rotation:** Every `/refresh` call consumes (revokes) the old session and issues a new one atomically, mitigating token theft risks.
- **Grace Period:** Implements a **30-second grace period** for revoked sessions to allow in-flight requests during token rotation to complete without error.
- **Session Limits:** Enforces a maximum of **5 active sessions** per user. When the limit is exceeded, the oldest expiring session is automatically revoked.
- **Active Session Visibility:** Users can view their active sessions, including device, IP, and timestamp information.
- **Flexible Revocation:** Supports both single session logout (revoking current token) and global logout (revoking all user sessions).
- **Security:** Password hashing uses **Argon2id**.

### 4.3 Categories

Hierarchical product categorization. Categories can have a parent category (e.g., Electronics > Phones).

### 4.4 Products

Core catalog management. Products belong to a category and contain pricing, inventory, and media metadata.

### 4.5 Sellers

Manages merchant/vendor profiles. A seller is always a registered user (`SELLER` role). Seller-specific data (store name, description, payout info) lives in a dedicated `sellers` table linked to `users.id` via a `userId` foreign key. This keeps authentication concerns in the `users` table while isolating seller domain data.

### 4.6 Orders

Manages the full order lifecycle: `PENDING → PAID → PROCESSING → SHIPPED → DELIVERED → CANCELLED`.

### 4.7 Payments

Records and processes payment intents. Integrates with external payment providers (e.g., Stripe). Statuses: `PENDING → COMPLETED → FAILED → REFUNDED`.

---

## 5. Distributed Event Flow & Transactional Integrity

The system employs the **Transactional Outbox Pattern** to ensure atomicity between DB writes and background jobs.

### Flow Diagram (Order Example)

```text
[Client]
   |
   +---(HTTP POST /orders)---> [OrdersRouter]
                                      |
                                      v
                               [OrdersController]
                                      |
                                      v
                               [OrdersService]
                                      |
         +----------------------------+----------------------------+
         | (Drizzle Transaction)                                   |
         v                                                         v
   [Postgres: orders] <-----------------------------> [Postgres: outbox_events]
         |                                                         |
         | (Commit)                                                |
         +----------------------------+----------------------------+
                                      |
                                      v
                            [Outbox Relayer / Poller]
                                      |
                                      +---(Publish to Queue)---> [Redis: BullMQ]
                                                                       |
         +----------------------------+----------------------------+   |
         v                            v                            v   v
   [Email Worker]           [Inventory Worker]          [Analytics Worker]
```

---

## 6. Background Job Engine (BullMQ)

We use **BullMQ** for robust background processing, providing isolation from the main HTTP thread.

### Key Features

- **Retries with Backoff:** Configurable exponential backoff for failing tasks.
- **Observability:** Jobs are tracked in Redis.
- **Isolation:** Workers run as separate processes or threads.

### Job Queues

| Queue               | Trigger         | Worker Action                             |
| :------------------ | :-------------- | :---------------------------------------- |
| `order.placed`      | Order confirmed | Send confirmation email, reduce inventory |
| `payment.completed` | Payment webhook | Advance order to `PROCESSING`             |
| `payment.failed`    | Payment webhook | Notify customer, restore cart             |

---

## 7. Database Schema & Data Modeling (Drizzle DSL)

Schemas are **co-located per module**. Each module defines its own table(s). The infrastructure barrel file re-exports everything for `drizzle-kit` and the runtime Drizzle client.

### `src/modules/users/users.model.ts`

```typescript
export const usersTable = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phoneNumber: varchar('phone_number', { length: 20 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    roles: userRoleEnum('roles').array().notNull().default([USER_ROLES.USER]),
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

### `src/modules/auth/auth.model.ts`

```typescript
// Refresh session store — co-located with the auth module
// The JWT `jti` claim maps to `id` for session lookup and rotation
export const refreshSessions = pgTable('refresh_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => usersTable.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    device: varchar('device', { length: 255 }),
    ip: varchar('ip', { length: 255 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Zod request validation
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['ADMIN', 'SELLER', 'CUSTOMER']).optional().default('CUSTOMER'),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
```

### `src/modules/categories/categories.model.ts`

```typescript
export const categories = pgTable('categories', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull().unique(),
    parentId: uuid('parent_id'), // self-referencing FK wired in barrel relations()
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### `src/modules/sellers/sellers.model.ts`

```typescript
export const sellers = pgTable('sellers', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().unique(), // FK → users.id (1-to-1)
    storeName: varchar('store_name', { length: 255 }).notNull().unique(),
    slug: varchar('slug', { length: 300 }).notNull().unique(),
    description: text('description'),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // NULL = active; soft-delete tombstone
});
```

> A seller **is** a user with `role = 'SELLER'`. The `sellers` table stores only domain-specific data (store profile). Identity and authentication remain in `users`.

### `src/modules/products/products.model.ts`

```typescript
export const products = pgTable('products', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 300 }).notNull().unique(),
    description: text('description'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    stock: integer('stock').notNull().default(0),
    categoryId: uuid('category_id'), // FK wired in barrel relations()
    sellerId: uuid('seller_id').notNull(), // FK → sellers.id
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // NULL = active; soft-delete tombstone
});

export const productImages = pgTable('product_images', {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id').notNull(), // FK → products.id
    url: text('url').notNull(),
    position: integer('position').notNull().default(0), // display order (0 = primary image)
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### `src/modules/orders/orders.model.ts`

```typescript
export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // FK → users.id (buyer), wired in barrel
    sellerId: uuid('seller_id'), // FK → sellers.id; set when order targets a single seller
    status: varchar('status', { length: 50 }).notNull().default('PENDING'),
    // PENDING | PAID | PROCESSING | SHIPPED | DELIVERED | CANCELLED
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
});
```

### `src/modules/payments/payments.model.ts`

```typescript
export const payments = pgTable('payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').notNull().unique(),
    provider: varchar('provider', { length: 50 }).notNull().default('stripe'),
    providerPaymentId: varchar('provider_payment_id', { length: 255 }),
    status: varchar('status', { length: 50 }).notNull().default('PENDING'),
    // PENDING | COMPLETED | FAILED | REFUNDED
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### `src/infrastructure/database/schema.ts` (barrel + cross-table relations)

```typescript
// Re-export all module models
export * from '../../modules/users/users.model';
export * from '../../modules/auth/auth.model'; // includes refreshTokens table
export * from '../../modules/categories/categories.model';
export * from '../../modules/sellers/sellers.model';
export * from '../../modules/products/products.model';
export * from '../../modules/orders/orders.model';
export * from '../../modules/payments/payments.model';

// Cross-table relations defined here to avoid circular imports
export const usersRelations = relations(users, ({ one, many }) => ({
    orders: many(orders),
    refreshTokens: many(refreshTokens),
    seller: one(sellers, { fields: [users.id], references: [sellers.userId] }),
}));

export const sellersRelations = relations(sellers, ({ one, many }) => ({
    user: one(users, { fields: [sellers.userId], references: [users.id] }),
    products: many(products),
    orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
    category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
    orderItems: many(orderItems),
    images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
    product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

// ... (orders, payments, order_items relations unchanged)

// Outbox events (infrastructure-owned, defined here directly)
export const outboxEvents = pgTable('outbox_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('PENDING'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 8. Authentication & Security Strategy

The platform implements a stateless **dual-token JWT** authentication strategy with **no Passport.js dependency**.

### Token Architecture

| Token             | Type                                | Lifetime   | Storage                        | Transport                              |
| :---------------- | :---------------------------------- | :--------- | :----------------------------- | :------------------------------------- |
| **Access Token**  | Signed JWT (`HS256`)                | 15 minutes | Client memory                  | `Authorization: Bearer <token>` header |
| **Refresh Token** | Signed JWT (`HS256`) carrying `jti` | 30 days    | HTTP-only cookie (path-scoped) | Cookie on `/api/v1/auth/refresh` only  |

### Key Security Controls

| Control                   | Mechanism                                                                                                                    |
| :------------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **Password hashing**      | Argon2id — 64 MiB memory cost, 3 iterations, parallelism 1                                                                   |
| **Token signing**         | Separate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` env vars                                                                 |
| **Refresh token storage** | Each refresh JWT contains a `jti` that references the `refresh_sessions.id` row; the raw token itself is never stored        |
| **Session Revocation**    | Revoked sessions are cached in **Redis** for fast lookups in middleware, with **PostgreSQL** as a persistent fallback source |
| **Token rotation**        | Every `/refresh` call revokes the old session and issues a new one atomically                                                |
| **Revocation**            | `revokedAt` timestamp on `refresh_sessions` row; logout + logout-all both supported                                          |
| **Cookie scope**          | `httpOnly`, `secure` (production), `sameSite: strict`, path restricted to `/api/v1/auth`                                     |
| **Rate limiting**         | `express-rate-limit` on `/login` and `/register` — 10 attempts / 15 min per IP                                               |
| **RBAC**                  | `requireRole('ADMIN' \| 'SELLER' \| 'CUSTOMER')` middleware chained after `requireAuth`                                      |

### Auth Flow

```text
LOGIN
  Client ──POST /auth/login──► AuthController
                                    │
                              AuthService.login()
                                    │
                          argon2.verify(hash, password)
                                    │
                    ┌───────────────┴──────────────────┐
                    │                                   │
             generateAccessToken()           generateRefreshToken()
             (JWT, 15 min)                   (JWT with jti, 30 days)
                    │                                   │
                    │                        INSERT refresh_sessions
                    │                        (id referenced by JWT `jti`)
                    │                                   │
  Response: { accessToken } ◄────────────────────────────┘
  Set-Cookie: refresh_token=<jwt> (httpOnly, path=/api/v1/auth)

AUTHENTICATED REQUEST
  Client ──GET /orders Authorization: Bearer <accessToken>──►
                                    │
                            requireAuth middleware
                                    │
                         tokenService.verifyAccessToken()
                                    │
                          req.user = { sub, email, role }
                                    │──► Controller

TOKEN REFRESH
  Client ──POST /auth/refresh Cookie: refresh_token=<jwt>──►
                                    │
                    jwt.verify(refreshToken, REFRESH_SECRET)
                                    │
                    DB: UPDATE refresh_sessions SET revokedAt=now
                        WHERE id = <jti> AND revokedAt IS NULL
                                    │
                    DB: INSERT new refresh_sessions row
                                    │
  Response: { accessToken } + Set-Cookie: new refresh_token

LOGOUT ALL DEVICES
  Client ──DELETE /auth/logout-all Authorization: Bearer <accessToken>──►
                                    │
                            requireAuth (validates access token)
                                    │
                    DB: UPDATE refresh_sessions SET revokedAt=now
                        WHERE userId=? AND revokedAt IS NULL
                                    │
  Response: 200 OK + Clear-Cookie
```

### Required Packages

**Runtime dependencies:**

- `jsonwebtoken`, `@types/jsonwebtoken`
- `argon2`
- `cookie-parser`, `@types/cookie-parser`
- `uuid`, `@types/uuid`
- `zod`
- `express-rate-limit` (already present)

---

## 9. Folder Structure (Clean Architecture Standard)

We utilize **Vertical Slicing** (Feature-based packaging) to keep related concerns together.
Each module **co-locates its own Drizzle schema** file. The infrastructure barrel re-exports all models for `drizzle-kit`.

```text
src/
├── modules/                        # Business Domains (Vertical Slices)
│   ├── users/
│   │   ├── controllers/            # HTTP handlers
│   │   ├── models/                 # Drizzle tables (e.g., users)
│   │   ├── repositories/           # Database operations
│   │   ├── routes/                 # Express sub-routers
│   │   ├── services/               # Business logic
│   │   └── users.module.ts         # Dependency composition file
│   ├── auth/
│   │   ├── controllers/            # register, login, refresh handlers
│   │   ├── dto/                    # Data transfer objects mapping
│   │   ├── models/                 # Drizzle tables (e.g., refresh_sessions)
│   │   ├── repositories/           # DB queries for tokens/auth state
│   │   ├── routes/                 # Router with rate limiting, etc.
│   │   ├── services/               # Core auth logic and token service
│   │   ├── types/                  # Internal type definitions
│   │   ├── validations/            # Zod request validation schemas
│   │   └── auth.module.ts          # Dependency composition file
│   ├── sellers/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   └── sellers.module.ts
│   ├── categories/
│   ├── products/
│   ├── orders/
│   └── payments/                   # All other modules follow the same structure
├── constants/                      # Shared system constants
├── errors/                         # Custom error definitions
├── utils/                          # Shared helper functions (e.g., jwt.util.ts, api-response.util.ts)
├── types/                          # Shared type definitions (pagination, typed-request, etc.)
├── infrastructure/                 # Infrastructure Adapters
│   ├── database/
│   │   ├── schema.ts               # Barrel: re-exports all module models + cross-table relations()
│   │   ├── repositories/           # Base repository abstractions
│   │   └── index.ts                # Drizzle client (Pool + drizzle(pool, { schema }))
│   ├── queue/                      # BullMQ config & workers
│   │   ├── queue.config.ts
│   │   └── workers/
│   └── logger/                     # Pino logger instance
├── middlewares/                    # Global app middlewares (error, validation, not found)
├── routes/                         # Top-level route aggregator (mounts module routers)
├── config/                         # App configuration & Zod env validation
│   └── env.ts
├── app.ts                          # Express app initialization (includes cookie-parser)
└── server.ts                       # Entry point
```

### Schema Co-location Strategy

```text
each module/*.model.ts   ──exports──►  infrastructure/database/schema.ts (barrel)
                                                  │
                          ◄──imports──   drizzle-kit (for migrations)
                                                  │
                          ◄──imports──   infrastructure/database/index.ts (runtime client)
```

Cross-table `relations()` are defined in the barrel to avoid circular imports between modules.

---

## 10. API Endpoints

### Users

| Method | Path                | Access       |
| :----- | :------------------ | :----------- |
| GET    | `/api/v1/users`     | ADMIN        |
| GET    | `/api/v1/users/:id` | ADMIN / Self |
| PATCH  | `/api/v1/users/:id` | Self         |
| DELETE | `/api/v1/users/:id` | ADMIN        |

### Auth

| Method | Path                           | Access          | Notes                                                         |
| :----- | :----------------------------- | :-------------- | :------------------------------------------------------------ |
| POST   | `/api/v1/auth/register`        | Public          | Rate-limited (10/15 min)                                      |
| POST   | `/api/v1/auth/login`           | Public          | Rate-limited (10/15 min); records `device`, `ip`, `userAgent` |
| POST   | `/api/v1/auth/refresh`         | Public (cookie) | Rotates refresh token                                         |
| GET    | `/api/v1/auth/active-sessions` | Authenticated   | Lists active sessions (device/ip/createdAt)                   |
| DELETE | `/api/v1/auth/logout`          | Authenticated   | Revokes current refresh token                                 |
| DELETE | `/api/v1/auth/logout-all`      | Authenticated   | Revokes all user refresh tokens                               |

### Categories

| Method | Path                     | Access |
| :----- | :----------------------- | :----- |
| GET    | `/api/v1/categories`     | Public |
| POST   | `/api/v1/categories`     | ADMIN  |
| PATCH  | `/api/v1/categories/:id` | ADMIN  |
| DELETE | `/api/v1/categories/:id` | ADMIN  |

### Sellers

| Method | Path                       | Access        | Notes                                                    |
| :----- | :------------------------- | :------------ | :------------------------------------------------------- |
| POST   | `/api/v1/sellers/register` | Authenticated | Upgrades user role to `SELLER` and creates `sellers` row |
| GET    | `/api/v1/sellers`          | ADMIN         | List all seller profiles                                 |
| GET    | `/api/v1/sellers/:id`      | Public        | Public store page                                        |
| GET    | `/api/v1/sellers/me`       | SELLER        | Own seller profile                                       |
| PATCH  | `/api/v1/sellers/me`       | SELLER        | Update store details                                     |
| DELETE | `/api/v1/sellers/:id`      | ADMIN         | Deactivate a seller                                      |

### Products

| Method | Path                                 | Access                 | Notes                                                  |
| :----- | :----------------------------------- | :--------------------- | :----------------------------------------------------- |
| GET    | `/api/v1/products`                   | Public                 |                                                        |
| GET    | `/api/v1/products/:id`               | Public                 |                                                        |
| GET    | `/api/v1/sellers/:sellerId/products` | Public                 | Products scoped to a seller's store                    |
| POST   | `/api/v1/products`                   | SELLER / ADMIN         | `sellerId` derived from `req.user.sub` for SELLER role |
| PATCH  | `/api/v1/products/:id`               | SELLER (owner) / ADMIN |                                                        |
| DELETE | `/api/v1/products/:id`               | SELLER (owner) / ADMIN |                                                        |

### Orders

| Method | Path                        | Access         | Notes                                        |
| :----- | :-------------------------- | :------------- | :------------------------------------------- |
| GET    | `/api/v1/orders`            | ADMIN          |                                              |
| GET    | `/api/v1/orders/my`         | Authenticated  | Buyer's own orders                           |
| GET    | `/api/v1/orders/seller`     | SELLER         | Orders containing this seller's products     |
| GET    | `/api/v1/orders/:id`        | ADMIN / Owner  |                                              |
| POST   | `/api/v1/orders`            | Authenticated  |                                              |
| PATCH  | `/api/v1/orders/:id/status` | ADMIN / SELLER | SELLER may update fulfilment sub-status only |

### Payments

| Method | Path                        | Access                   |
| :----- | :-------------------------- | :----------------------- |
| POST   | `/api/v1/payments`          | Authenticated            |
| GET    | `/api/v1/payments/:orderId` | Authenticated            |
| POST   | `/api/v1/payments/webhook`  | Public (provider-signed) |

---

## 11. Development & Tooling

- **Dependency Injection:** Components are wired manually through constructors, enabling easy mocking for unit tests without a container library.
- **Migrations:** **Drizzle Kit** manages schema migrations (`drizzle-kit generate` / `drizzle-kit migrate`).
- **Documentation:** **Swagger-jsdoc** for generating OpenAPI specs from JSDoc comments.
- **Testing:** **Jest** for unit tests and **Supertest** for API integration tests.

## 12. Future Scalability

- **Cluster Mode:** Use Node.js `cluster` module or **PM2** to scale across CPU cores.
- **Caching:** Redis-based caching middleware for GET requests.
- **Security:** Integrated `helmet`, `cors`, and `express-rate-limit`.
