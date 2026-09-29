# Facts

- POST /auth/login with a valid hardcoded email and password returns 200 { ok: true, data: { accessToken, tokenType: 'Bearer', expiresIn } }.
- POST /auth/login with an unknown email or a wrong password returns 401 with code InvalidCredentialsError and the same message in both cases.
- POST /auth/login with a missing or malformed email/password returns 400 VALIDATION_FAILED (zod DTO).
- Hardcoded users are { id, email, passwordHash } with no roles; passwords are stored as scrypt hashes (node:crypto) and compared in constant time. No plaintext password appears in source code.
- The user list sits behind a port in modules/auth (in-memory repository in infrastructure/), so a database can replace it without touching the service.
- GET /auth/me with a valid Bearer token returns 200 { ok: true, data: { id, email } } for the logged-in user.
- Every route requires a valid Bearer token by default (global guard); this includes health and greeting endpoints.
- A missing, malformed, invalid-signature, or expired token returns 401 { ok: false, error: { code: 'UNAUTHORIZED', ... } } through the envelope.
- @Public() from app/http/auth/public.decorator.ts skips the guard when placed on a handler or on a whole controller class; POST /auth/login is the only public route.
- @CurrentUser() param decorator from app/http/auth/ gives a handler the authenticated user ({ id, email }) from the token.
- JWT verification uses only @nestjs/jwt (no Passport): a global CanActivate guard verifies the Bearer token with JwtService; the guard and JwtModule wiring live in src/app/auth/ and are registered once from AppModule.
- modules/auth issues tokens through a token-issuer port (interface + Symbol token); the implementation lives in app/auth/ and modules/auth never imports @nestjs/jwt or app/config.
- JWT_SECRET (required, no default, min 32 chars) and JWT_EXPIRES_IN (default 1h) are validated in AppConfigSchema, listed in .env.example, and covered in app-config.spec.ts. The app refuses to start without JWT_SECRET.
- Token payload holds only sub (user id) and email; passwords and tokens are never logged.
- dependency-cruiser allows modules/*/presentation to import app/http/auth/ (like app/http/errors/); no other boundary rule is weakened.
- apps/api/AGENTS.md documents the auth pattern (public-by-exception, @Public, @CurrentUser, token port, env vars, dev login credentials) and the Pattern Index points to the reference files.
- Out of scope: refresh tokens, logout/revocation, roles, rate limiting, registration, Swagger auth.
- pnpm check is green.
