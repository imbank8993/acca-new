import { Controller, Get, Post, Patch, Request, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KlinikService } from './klinik.service';

@UseGuards(JwtAuthGuard)
@Controller('klinik')
export class KlinikController {
  constructor(private readonly klinikService: KlinikService) {}

  @Get()
  async get(@Request() req: any, @Query('action') action: string, @Query() allQueries: any) {
    const searchParams = new URLSearchParams(allQueries as any);
    return await this.klinikService.handleGet(req, action, searchParams);
  }

  @Post()
  async post(@Request() req: any, @Body() body: any) {
    const { action, ...payload } = body;
    return await this.klinikService.handlePost(req, action, payload);
  }

  @Patch()
  async patch(@Request() req: any, @Body() body: any) {
    const { action, id, ...payload } = body;
    return await this.klinikService.handlePatch(req, action, id, payload);
  }
}
