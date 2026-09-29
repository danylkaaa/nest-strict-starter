# Plan: JWT authentication with hardcoded users

Facts: `goals/jwt-auth/facts.md`. Execution: the `implement-plan` skill (api-implementer → api-reviewer loop), since this is `apps/api` code.

## Approach

Two halves, split by the boundary rules (`app/` must not import `modules/`):

- **`src/app/auth/` (wiring)**: `@nestjs/passport` + `passport-jwt` `JwtStrategy`, a global `JwtAuthGuard` (`APP_GUARD`), `JwtModule.registerAsync` fed by `AppConfig`, and the adapter that implements the token-issuer port with `JwtService`. `AuthWiringModule` is imported once by `AppModule`.
- **`src/app/http/auth/` (importable by `presentation/`)**: `@Public()` and `@CurrentUser()` decorators plus the `IS_PUBLIC_KEY` metadata key. Allowlisted like `app/http/errors/`.
- **`src/shared-kernel/auth/` (contract)**: the `TokenIssuer` port (interface + `TOKEN_ISSUER` Symbol) and the `AuthenticatedUser` type `{ id, email }`. It has to live here: `app/auth` implements it and `modules/auth` consumes it, and neither side may import the other.
- **`src/modules/auth/` (business)**: login and me. Stage 3 layering: a `domain/auth.errors.ts` file for errors, plus `application/ports`, `application/services`, `infrastructure`, and `presentation`.

Flow: `POST /auth/login` → `AuthService.login(email, password)` → `UserRepository.findByEmail` → `PasswordVerifier.verify` → `TokenIssuer.issue({ id, email })` → `LoginResponseDto`. For every other route, `JwtAuthGuard` checks `IS_PUBLIC_KEY` via `Reflector.getAllAndOverride([handler, class])`, otherwise it runs passport-jwt. `JwtStrategy.validate` maps `{ sub, email }` → `AuthenticatedUser` on `req.user`. Any failure throws `UnauthorizedError` (`app/http/errors`), which the envelope renders as 401 `UNAUTHORIZED`.

## Steps

### 1. Dependencies and config

- `pnpm --filter api add @nestjs/passport @nestjs/jwt passport passport-jwt` and `pnpm --filter api add -D @types/passport-jwt` (Nest 12 peers OK: @nestjs/passport 12.0.0, @nestjs/jwt 12.0.2).
- `app/config/app-config.ts`: `JWT_SECRET: z.string().min(32)` (no default) and `JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600)` (seconds, so 1h; the response's `expiresIn` uses the same number with no parsing).
- `app-config.spec.ts`: missing secret fails, short secret fails, expiry default is 3600.
- `.env.example`: both vars with comments. `vitest.config.mts` `test.env`: add a 32+ char test `JWT_SECRET`.
- **Verify:** `pnpm --filter api test -- app-config`, `pnpm --filter api typecheck`.

### 2. Shared contract

- `shared-kernel/auth/authenticated-user.ts`: `type AuthenticatedUser = { id: string; email: string }`.
- `shared-kernel/auth/token-issuer.port.ts`: `interface TokenIssuer { issue(user): ResultAsync<IssuedToken, TokenIssueError> }` plus `TOKEN_ISSUER` Symbol. `IssuedToken = { accessToken; expiresIn }`. `TokenIssueError` extends `BusinessError`.
- **Verify:** `pnpm --filter api deps`.

### 3. Decorators (`app/http/auth/`)

- `public.decorator.ts`: `IS_PUBLIC_KEY` plus `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`, which works on both method and class.
- `current-user.decorator.ts`: `createParamDecorator` returning `request.user` as `AuthenticatedUser`.
- `.dependency-cruiser.mjs`: `modules-app-allowlist` pathNot becomes `^src/app/(base|http/errors|http/auth)/`. The existing `http-errors-presentation-only` rule already limits `app/http/*` to `presentation/`. No other rule changes.
- **Verify:** unit spec for `@CurrentUser` factory, then `pnpm --filter api deps`.

### 4. JWT wiring (`app/auth/`)

- `jwt.strategy.ts`: `PassportStrategy(Strategy)`, `fromAuthHeaderAsBearerToken()`, `ignoreExpiration: false`, secret from `AppConfig`, and `validate(payload) → { id: payload.sub, email: payload.email }`.
- `jwt-auth.guard.ts`: `extends AuthGuard('jwt')`. Public routes return `true`. `handleRequest` throws `new UnauthorizedError()` when the user is missing or on error.
- `jwt-token-issuer.ts`: implements `TokenIssuer` with `ResultAsync.fromPromise(jwtService.signAsync({ sub, email }), () => new TokenIssueError())`. The payload holds only `sub` and `email`.
- `auth-wiring.module.ts`: `@Global()`. Imports `PassportModule` and `JwtModule.registerAsync({ inject: [AppConfig], useFactory })`. Provides `JwtStrategy`, `{ provide: APP_GUARD, useClass: JwtAuthGuard }`, and `{ provide: TOKEN_ISSUER, useClass: JwtTokenIssuer }`. Exports `TOKEN_ISSUER`.
- `app.module.ts`: import `AuthWiringModule` after `ConfigModule`.
- **Verify:** guard spec with a mocked `Reflector` (public on handler, public on class, not public). Strategy `validate` spec.

### 5. `modules/auth/`

- `domain/auth.errors.ts`: `InvalidCredentialsError` (message "Email or password is incorrect.") and the `AuthError` union.
- `application/ports/user-repository.port.ts` (`findByEmail → ResultAsync<User | null, …>` or `Option`-style) and `password-verifier.port.ts` (`verify(plain, hash) → ResultAsync<boolean, …>`), each with a Symbol token.
- `infrastructure/in-memory-user.repository.ts`: 2 users `{ id, email, passwordHash }` with pre-computed `scrypt$<salt>$<hash>` strings, no plaintext.
- `infrastructure/scrypt-password-verifier.ts`: `node:crypto` `scrypt` plus `timingSafeEqual`. An unknown email is still verified against a dummy hash, so both failure paths take the same time and return the same error.
- `application/services/auth.service.ts`: `login(email, password) → ResultAsync<IssuedToken, AuthError | TokenIssueError>`, using `safeTry` for the 3 steps. It never logs the password or the token.
- `presentation/dtos/`: `login-request.dto.ts` (`email: z.email()`, `password: z.string().min(1)`), `login-response.dto.ts` (`accessToken`, `tokenType: z.literal('Bearer')`, `expiresIn`), and `me-response.dto.ts` (`id`, `email`).
- `presentation/auth.controller.ts`: `@Controller('auth')`. `@Public() @Post('login') @HttpCode(200)` maps `InvalidCredentialsError` → `new UnauthorizedError(msg, name)` and `TokenIssueError` → `InternalServerError`. `@Get('me')` uses `@CurrentUser()` and returns `MeResponseDto`.
- `UnauthorizedError` gains an optional `name` param, the same way `BadRequestError` has one, so the code becomes `InvalidCredentialsError`, plus a spec case.
- `auth.module.ts`: registered in `AppModule.imports`.
- **Verify:** specs for the service (fake ports: success, unknown email, wrong password, issuer failure), the scrypt verifier (correct, wrong, malformed hash), the in-memory repo, and the controller (error mapping).

### 6. Integration tests (`app.module.spec.ts`)

- Add a `login()` helper for the existing envelope tests, which now need a token on `/greeting`.
- New `describe('auth')` cases:
  - login OK shape (fact 1)
  - wrong password and unknown email return the same body (fact 2)
  - bad body gives 400 (fact 3)
  - `/auth/me` returns 200 with a token (fact 6)
  - `/health` and `/greeting` return 401 without a token (fact 7)
  - missing, malformed, bad-signature, and expired tokens each return 401 `UNAUTHORIZED` (fact 8; build expired and forged tokens with `JwtService` using `expiresIn: -1` or a different secret)
  - class-level `@Public` gets a unit guard spec (fact 9)
- **Verify:** `pnpm --filter api test`.

### 7. Docs and final check

- `apps/api/AGENTS.md` changes:
  - new "Authentication" section: secure by default, `@Public()` on handler or class, `@CurrentUser()`, the token-issuer port in shared-kernel, env vars, and dev credentials for the 2 users
  - `app/` structure tree gets `auth/` and `http/auth/`
  - dependency direction allowlist line and "Current variables" list updated
  - Pattern Index rows added
- `main.ts` banner: no change needed (health link stays).
- **Verify:** `pnpm check` is green.

## Risks / open questions

1. **shared-kernel admission.** AGENTS.md admits a contract "when the second consumer appears". Here it is 1 consumer + 1 implementer across the app/module boundary, which is the only legal place for it. The AGENTS.md update records this exception.
2. **Plaintext in tests.** Integration specs must log in with a real password, so "no plaintext in source" means non-test source. The dev passwords also appear in AGENTS.md (fact 16).
3. **Health is protected.** Load balancer or k8s liveness probes will get 401 unless they send a token. This matches your answer, but flagging it.
4. **`JWT_EXPIRES_IN` is seconds, not `"1h"`.** An integer keeps `expiresIn` in the response exact and avoids a duration-parsing dep.
5. **ESM + passport-jwt (CJS).** Default imports should work under NodeNext. If lint or typecheck complains, use named imports (`import { ExtractJwt, Strategy } from 'passport-jwt'`).
