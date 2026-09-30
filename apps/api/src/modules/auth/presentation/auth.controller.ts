import {
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ok } from 'neverthrow';

import { Public } from '@/app/http/auth/public.decorator.js';
import { RequestContext } from '@/app/http/context/request-context.js';
import { toHttpException } from '@/app/http/errors/to-http-exception.js';
import { AuthService } from '@/modules/auth/application/services/auth.service.js';
import { LoginRequestDto } from '@/modules/auth/presentation/dtos/login-request.dto.js';
import { LoginResponseDto } from '@/modules/auth/presentation/dtos/login-response.dto.js';
import { MeResponseDto } from '@/modules/auth/presentation/dtos/me-response.dto.js';

import type { HttpExceptionClass } from '@/app/http/errors/to-http-exception.js';
import type { AuthError } from '@/modules/auth/domain/auth.errors.js';
import type { TokenIssueError } from '@/shared-kernel/auth/token-issuer.port.js';
import type { HttpException } from '@nestjs/common';
import type { Result, ResultAsync } from 'neverthrow';

type LoginError = AuthError | TokenIssueError;

// One explicit exception class per domain error; a new error will not compile until it is listed here.
const HTTP_EXCEPTION_FOR = {
  InvalidCredentialsError: UnauthorizedException,
  PasswordVerificationError: InternalServerErrorException,
  TokenIssueError: InternalServerErrorException,
  UserLookupError: InternalServerErrorException,
} satisfies Record<LoginError['name'], HttpExceptionClass>;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContext: RequestContext,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginRequestDto): ResultAsync<LoginResponseDto, HttpException> {
    return this.authService
      .login(body.email, body.password)
      .map(({ accessToken, expiresIn }) =>
        LoginResponseDto.create({ accessToken, expiresIn, tokenType: 'Bearer' }),
      )
      .mapErr((error) => toHttpException(error, HTTP_EXCEPTION_FOR));
  }

  @Get('me')
  me(): Result<MeResponseDto, HttpException> {
    const user = this.requestContext.getUser();
    return ok(MeResponseDto.create({ email: user.email, id: user.id }));
  }
}
