import { Body, Controller, Delete, Get, Patch, Post, Query, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EkskulSubmissionService } from './ekskul-submission.service';

@ApiTags('Ekskul Submission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ekskul/submission')
export class EkskulSubmissionController {
  constructor(private readonly service: EkskulSubmissionService) {}

  @Get()
  async getSubmissions(@Request() req: any, @Query() query: any) {
    return await this.service.getSubmissions(req.user, query);
  }

  @Post()
  async postSubmission(@Request() req: any, @Body() body: any) {
    return await this.service.postSubmission(req.user, body);
  }

  @Delete()
  async deleteSubmission(@Request() req: any, @Query('id') id: string) {
    return await this.service.deleteSubmission(req.user, id);
  }

  @Post('pembayaran')
  async postPembayaran(@Request() req: any, @Body() body: any) {
    return await this.service.postPembayaran(req.user, body);
  }
}
