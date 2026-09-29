import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AppModule } from '@/app.module.js'

import type { INestApplication } from '@nestjs/common'

describe('response envelope', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('wraps success in { ok: true, data }', async () => {
    const response = await request(app.getHttpServer()).get('/greeting?name=Ada')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, data: { message: 'Hello, Ada!' } })
  })

  it('wraps a domain failure in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer()).get('/greeting?name=')
    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Please enter a name.' },
    })
  })

  it('wraps an unknown route in { ok: false, error }', async () => {
    const response = await request(app.getHttpServer()).get('/nope')
    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
