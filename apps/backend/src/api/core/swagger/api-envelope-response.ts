import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import type { Type } from '@nestjs/common';
import type { ApiResponseSchemaHost } from '@nestjs/swagger';

const errorSchema: ApiResponseSchemaHost['schema'] = {
  properties: {
    error: {
      properties: { code: { type: 'string' }, message: { type: 'string' } },
      required: ['code', 'message'],
      type: 'object',
    },
    ok: { enum: [false], type: 'boolean' },
  },
  required: ['ok', 'error'],
  type: 'object',
};

export function ApiEnvelopeResponse(type: Type<unknown>, status = 200) {
  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      schema: {
        properties: {
          data: { $ref: getSchemaPath(type) },
          ok: { enum: [true], type: 'boolean' },
        },
        required: ['ok', 'data'],
        type: 'object',
      },
      status,
    }),
    ApiResponse({
      description: 'Invalid request or rejected business input.',
      schema: errorSchema,
      status: 400,
    }),
    ApiResponse({
      description: 'Unexpected internal error. Details are not exposed.',
      schema: errorSchema,
      status: 500,
    }),
  );
}
