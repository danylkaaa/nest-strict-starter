/** The user a valid access token stands for. Stored by the global JWT guard in `RequestContext`. */
export type AuthenticatedUser = { id: string; email: string };
