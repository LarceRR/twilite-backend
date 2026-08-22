import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';
import { reportError } from '@/infrastructure/sentry/sentry';
import type { ErrorResponse } from '@/shared/contracts/common.contract';
import {
  AppError,
  ErrorCode,
  type FieldViolation,
  toAppError,
  ValidationError,
} from '@/shared/errors';
@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(@Inject(Logger) private readonly logger: Logger) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const error = this.normalize(exception);
    const body: ErrorResponse = { ...error.toPublicJson(), requestId: String(request.id) };
    const logPayload = {
      requestId: request.id,
      kind: error.kind,
      code: error.code,
      status: error.httpStatus,
      context: error.context,
      err: error.origin ?? error,
    };
    if (error.httpStatus >= 500) {
      this.logger.error(logPayload, error.message);
      reportError(error, { requestId: String(request.id) });
    } else this.logger.warn(logPayload, error.message);
    void reply.status(error.httpStatus).send(body);
  }
  private normalize(exception: unknown): AppError {
    if (exception instanceof AppError) return exception;
    if (exception instanceof ZodValidationException)
      return new ValidationError('Некорректные данные запроса', toViolations(exception));
    if (exception instanceof HttpException) return new HttpExceptionAdapter(exception);
    return toAppError(exception);
  }
}
type ZodIssueLike = { path?: readonly (string | number)[]; message?: string };
function toViolations(exception: ZodValidationException): readonly FieldViolation[] {
  const error = exception.getZodError();
  const issues = (error as { issues?: readonly ZodIssueLike[] } | null)?.issues;
  if (issues === undefined) return [];
  return issues.map((issue) => ({
    path: (issue.path ?? []).join('.'),
    message: issue.message ?? 'Некорректное значение',
  }));
}
class HttpExceptionAdapter extends AppError {
  readonly kind = 'unknown' as const;
  readonly code = ErrorCode.INTERNAL_ERROR;
  readonly httpStatus: number;
  constructor(exception: HttpException) {
    super(exception.message, {}, exception);
    this.httpStatus = exception.getStatus();
  }
  override toPublicJson(): { kind: 'unknown'; code: ErrorCode; message: string } {
    return { kind: this.kind, code: this.code, message: this.message };
  }
}
