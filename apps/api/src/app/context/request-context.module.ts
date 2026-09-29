import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Opens an async context (nestjs-cls) for every HTTP request and gives it a unique id.
 * The id is always generated server-side (a client-supplied id is never trusted) and returned in
 * the `X-Request-Id` response header. `ClsService` is global; read the id with `cls.getId()`.
 * Import once, in `AppModule`, before `AppLoggerModule`.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        generateId: true,
        idGenerator: () => randomUUID(),
        mount: true,
        setup: (cls, _req, res: { setHeader: (name: string, value: string) => void }) => {
          res.setHeader(REQUEST_ID_HEADER, cls.getId());
        },
      },
    }),
  ],
})
export class RequestContextModule {}
