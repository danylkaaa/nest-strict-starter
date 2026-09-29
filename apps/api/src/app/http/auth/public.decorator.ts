import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips the global JWT guard. Place on a handler or on a whole controller class. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
