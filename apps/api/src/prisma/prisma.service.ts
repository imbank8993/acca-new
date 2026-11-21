import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withPoolDefaults } from './database-url';

/** Bawaan pool acca-api; ubah lewat API_DB_CONNECTION_LIMIT (lihat database-url.ts). */
export const DEFAULT_API_DB_CONNECTION_LIMIT = 20;

function prismaClientOptions(): { datasourceUrl: string } | undefined {
  const datasourceUrl = withPoolDefaults(process.env.DATABASE_URL, {
    limitEnv: 'API_DB_CONNECTION_LIMIT',
    defaultLimit: DEFAULT_API_DB_CONNECTION_LIMIT,
  });
  return datasourceUrl ? { datasourceUrl } : undefined;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super(prismaClientOptions());
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma Client successfully connected to PostgreSQL');
    } catch (error: any) {
      this.logger.warn(`Prisma connection pending/deferred: ${error.message || error}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Client disconnected from PostgreSQL');
  }
}
