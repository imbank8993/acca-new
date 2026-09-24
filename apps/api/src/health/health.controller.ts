import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check server health and Prisma PostgreSQL status' })
  @ApiResponse({ status: 200, description: 'Server and Database services status' })
  async check() {
    let prismaStatus = 'disconnected';

    try {
      // Execute raw query using Prisma ORM to test PostgreSQL connection
      await this.prismaService.$queryRaw`SELECT 1`;
      prismaStatus = 'connected (PostgreSQL)';
    } catch (err: any) {
      prismaStatus = `error: ${err.message || err}`;
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ACCA NestJS Backend',
      prisma_postgresql: prismaStatus,
    };
  }
}
