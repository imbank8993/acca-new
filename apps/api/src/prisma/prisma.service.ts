import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { withAuditContext } from '@acca/shared';
import { auditContext } from '../common/audit-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    return withAuditContext(this, () => auditContext.getStore());
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
