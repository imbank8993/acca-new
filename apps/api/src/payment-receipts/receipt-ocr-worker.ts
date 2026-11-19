import { createServer } from 'http';
import { BadRequestException, HttpException } from '@nestjs/common';
import { LocalReceiptOcr } from './local-receipt-ocr';

const ocr = new LocalReceiptOcr();
const port = Number(process.env.PORT || 3010);

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET' && request.url === '/health') {
    response.statusCode = ocr.available() ? 200 : 503;
    response.end(JSON.stringify({ ok: response.statusCode === 200 }));
    return;
  }
  if (request.method !== 'POST' || request.url !== '/extract') {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Rute tidak ditemukan.' }));
    return;
  }
  if (request.headers['content-type'] !== 'application/octet-stream') {
    response.statusCode = 415;
    response.end(JSON.stringify({ error: 'Format permintaan tidak valid.' }));
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) throw new BadRequestException('Gambar maksimal 5 MB.');
      chunks.push(chunk);
    }
    if (size < 32) throw new BadRequestException('Gambar tidak valid.');
    const fields = await ocr.extract(Buffer.concat(chunks));
    response.end(JSON.stringify({ fields }));
  } catch (error) {
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.statusCode = status;
    response.end(JSON.stringify({ error: error instanceof HttpException ? error.message : 'Pembacaan bukti gagal.' }));
  }
});

server.requestTimeout = 70000;
server.headersTimeout = 10000;
server.listen(port, '0.0.0.0');
