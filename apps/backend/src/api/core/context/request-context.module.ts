import { randomUUID } from 'node:crypto';

import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { Global, Module } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { ClsModule } from 'nestjs-cls';

import { RequestContext } from '@/api/core/context/request-context';
import { DatabaseModule } from '@/common/database/database.module';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Opens an async context (nestjs-cls) for every HTTP request and gives it a unique id.
 * The id is always generated server-side (a client-supplied id is never trusted) and returned in
 * the `X-Request-Id` response header. `ClsService` is global; read the id with `cls.getId()`.
 * Also provides and exports `RequestContext` globally, so the guard and any controller can inject it.
 * Import once, in `AppModule`, before `AppLoggerModule`.
 */
@Global()
@Module({
  exports: [RequestContext],
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
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: getDrizzleToken() }),
          imports: [DatabaseModule],
        }),
      ],
    }),
  ],
  providers: [RequestContext],
})
export class RequestContextModule {}
