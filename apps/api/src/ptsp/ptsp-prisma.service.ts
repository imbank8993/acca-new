import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/ptsp-client';

function getPtspDatasource() {
  const url = process.env.PTSP_DATABASE_URL;
  if (!url) {
    throw new Error('PTSP_DATABASE_URL is required to start the PTSP module');
  }
  return { datasources: { db: { url } } };
}

@Injectable()
export class PtspPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PtspPrismaService.name);

  constructor() {
    super(getPtspDatasource());
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to the dedicated PTSP PostgreSQL database');
    } catch (error: any) {
      this.logger.error(`Could not connect to the dedicated PTSP database: ${error.message || error}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
