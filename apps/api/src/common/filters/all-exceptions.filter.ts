import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message || 'Internal Server Error';

    // Nest sendiri memakai `message` (BadRequestException dkk). Sebagian service
    // melempar payload gaya API-nya sendiri, `{ ok: false, error: '...' }` —
    // tanpa cabang `.error` di bawah, payload itu diteruskan utuh sebagai objek
    // dan klien menampilkan "[object Object]" alih-alih alasannya.
    const errorMessage = typeof message === 'object' && message !== null
      ? (message as any).message || (message as any).error || message
      : message;

    // Log internal tetap memuat pesan asli lengkap — itu yang dibutuhkan saat
    // menelusuri masalah.
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${JSON.stringify(errorMessage)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Yang dikirim ke pemanggil hanya pesan dari HttpException yang memang
    // sengaja ditulis untuk pengguna. Galat tak terduga (mis. Prisma) dibalas
    // pesan umum: pesan aslinya memuat path absolut server beserta cuplikan
    // kode sumber, dan endpoint yang memicunya bisa jadi anonim.
    const aman = exception instanceof HttpException
      ? errorMessage
      : 'Terjadi kesalahan pada server. Silakan coba lagi.';

    response.status(status).json({
      ok: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: aman,
    });
  }
}
