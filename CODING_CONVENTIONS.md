# Coding Style & Architecture Conventions

This document describes the coding style, architectural patterns, and conventions used in this project to ensure consistency, maintainability, and scalability.

---

## 1. Project Architecture

The project follows a layered architecture with feature-based modules.

```
Request
   ↓
Router
   ↓
Middleware (validation, auth, logging)
   ↓
Controller
   ↓
Service (business logic)
   ↓
Repository (database access)
```

Each layer has a single responsibility.

| Layer      | Responsibility              |
|------------|-----------------------------|
| Router     | Define HTTP endpoints        |
| Middleware | Request validation, authentication, preprocessing |
| Controller | Handle HTTP request/response |
| Service    | Business logic             |
| Repository | Database queries        |

---

## 2. Feature-Based Module Structure

Code is organized by feature modules instead of technical layers.

Example structure:

```
src/modules/auth
│
├── controllers
│   └── auth.controller.ts
│
├── services
│   └── auth.service.ts
│
├── repositories
│   └── auth.repository.ts
│
├── dto
│
├── validations
│
├── types
│
├── routes
│   └── auth.routes.ts   ← defines HTTP endpoints, delegates to controllers
│
└── auth.module.ts
```

Each module is self-contained and manages its own dependencies.

---

## 3. Manual Dependency Injection

The project uses manual dependency injection instead of a DI container (e.g., Awilix).

Dependencies are composed within each module.

Each feature module must define its own composition file responsible for wiring its dependencies.

Typical module composition files:

```
auth.module.ts
users.module.ts
orders.module.ts
```

These files define the dependency graph:

```
Repository → Service → Controller
```

### Example: Module Composition

```typescript
/**
 * Auth Module
 * @module auth
 * @description Composes and exports authentication module dependencies.
 */

import { db } from '@infrastructure/database';
import AuthController from './controllers/auth.controller';
import AuthService from './services/auth.service';
import { AuthRepository } from './repositories';

const authRepository = new AuthRepository(db);
const authService = new AuthService(authRepository);

export const authController = new AuthController(authService);
```

### Usage in Routes

Routes import the composed controller from the module.

```typescript
import { authController } from '../auth.module';

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
```

### Why Dependency Injection Is Per Module

Each module is self-contained.

Benefits:
- Explicit dependency graph
- Easier debugging
- Simpler testing
- No runtime container overhead
- Better TypeScript inference
- Better module isolation
- Easier refactoring

Dependency graph example:

```
AuthRepository
      ↓
AuthService
      ↓
AuthController
```

### Module Isolation Rule

Modules should not instantiate dependencies from other modules directly.

Each module composes its own dependencies and exposes only what other modules need.

### Summary Rule

Every feature module must contain a composition file that wires its dependencies.

```
auth/
  controllers/
  services/
  repositories/
  routes/
  auth.module.ts   ← dependency wiring
```

---

## 4. Controllers

Controllers should remain thin and only handle HTTP concerns.

Responsibilities:
- Receive validated request data
- Call services
- Format responses

Example:

```typescript
register = async (req: TypedRequest<typeof registerSchema>, res: Response) => {
    const user = await this.authService.registerUser(req.body);

    const userDto = toAuthUserDto(user);

    return res
        .status(HTTP_STATUS.CREATED)
        .json(successResponse(userDto, 'User registered successfully'));
};
```

Controllers must not contain business logic.

---

## 5. Services

Services contain business logic.

Example:

```typescript
async registerUser(data: RegisterDto) {
    const user = await this.authRepository.createUser(data);
    return user;
}
```

Services should:
- Be framework-agnostic
- Be easily unit-testable
- Not depend on Express

---

## 6. Repositories

Repositories manage database access.

Example:

```typescript
async createUser(data: CreateUserInput) {
    return db.insert(users).values(data);
}
```

Responsibilities:
- Contain database queries
- Return data models
- No business logic

---

## 7. Request Validation

All request validation is handled by middleware using Zod.

Example schema:

```typescript
export const registerRequestSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
    }).strict()
});
```

Routes apply validation middleware:

```typescript
router.post(
    '/register',
    validateRequest(registerRequestSchema),
    authController.register
);
```

Controllers receive validated data only.

---

## 8. Typed Requests

Controllers use a custom `TypedRequest` helper to infer request types from validation schemas.

Example:

```typescript
register = async (
  req: TypedRequest<typeof registerRequestSchema>,
  res: Response
) => { }
```

Benefits:
- Schema-driven typing
- No duplicate DTO definitions
- Strong TypeScript inference

---

## 9. API Response Standard

All successful responses use a consistent format.

Example:

```typescript
successResponse(data, message)
```

Example output:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {}
}
```

---

## 10. Error Handling

Errors should use custom error classes.

Example:

- `AppError`
- `ValidationError`
- `AuthenticationError`

Errors are handled by a global error middleware.

Controllers and services should throw errors, not handle them.

---

## 11. Layer Dependency Rules

Controllers must not import repositories directly.
Services must not import controllers.
Repositories must not depend on services.

Dependency direction:

```
Controller → Service → Repository
```

This prevents architectural drift.

---

## 12. Naming Conventions

| Component          | Convention          |
|--------------------|---------------------|
| Controllers        | auth.controller.ts  |
| Services           | auth.service.ts     |
| Repositories       | auth.repository.ts  |
| Schemas            | auth.validation.ts  |
| DTOs               | auth.dto.ts         |
| Module composition | auth.module.ts      |

---

## 13. JSDoc Module Naming Convention

Every file should declare a logical module using JSDoc.

Module names should represent logical feature modules, not file names.

### Module Root

```typescript
/**
 * Auth Module
 * @module auth
 * @description Composes and exports authentication module dependencies.
 */
```

### Controllers

```typescript
/**
 * AuthController
 * @module auth/controllers
 * @description Handles authentication operations.
 */
```

### Services

```typescript
/**
 * AuthService
 * @module auth/services
 */
```

### Repositories

```typescript
/**
 * AuthRepository
 * @module auth/repositories
 */
```

### DTOs

```typescript
/**
 * Auth DTOs
 * @module auth/dto
 */
```

### Validations

```typescript
/**
 * Auth Validation Schemas
 * @module auth/validations
 */
```

### Index Files

Index files represent the folder module, not the filename.

Correct:

```typescript
/**
 * Auth Controllers
 * @module auth/controllers
 */
```

Incorrect:

```typescript
@module auth/controllers/index
```

---

## 14. Import Conventions

Use path aliases instead of long relative imports.

Example:

```typescript
import { db } from '@infrastructure/database';
import { ValidationError } from '@errors/validation.error';
```

Avoid:

```typescript
../../../errors
```

---

## 15. Testing Strategy

Three types of tests are recommended.

### Service Unit Tests

Test business logic.

```
tests/services/auth.service.test.ts
```

### Middleware Unit Tests

Test validation middleware.

```
tests/middlewares/validateRequest.test.ts
```

### Integration Tests

Use supertest to test API endpoints.

```
tests/integration/auth.test.ts
```

Integration flow tested:

```
router → middleware → controller → service
```

---

## 16. Core Principles

The project follows these core principles:
- Single Responsibility Principle
- Explicit dependencies
- Feature-based modular design
- Schema-first validation
- Thin controllers
- Testable services

---

## Summary

Key architectural decisions:
- Feature-based modules
- Manual dependency injection
- Zod validation middleware
- TypedRequest for controller typing
- Layered architecture
- Standardized API responses

These conventions ensure the codebase remains scalable, maintainable, and easy to understand.
