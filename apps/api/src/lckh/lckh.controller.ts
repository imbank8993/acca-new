import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LckhService } from './lckh.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('lckh')
@UseGuards(JwtAuthGuard)
export class LckhController {
  constructor(private readonly lckhService: LckhService) {}

  private getApiUser(reqUser: any) {
    const roles: string[] = reqUser?.roles || (reqUser.role
      ? reqUser.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
      : []);
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const nip = reqUser.nip || '';
    const authId = reqUser.auth_id;
    const nama_lengkap = reqUser.nama_lengkap || reqUser.nama || '';
    const nama = reqUser.nama || '';

    return { nip, roles, isAdmin, authId, id: reqUser.id, nama_lengkap, nama };
  }

  @Get('nilai-detail')
  async getNilaiDetail(@Req() req: any, @Query() query: any) {
    return this.lckhService.getNilaiDetail(query, this.getApiUser(req.user));
  }

  @Get('print/data')
  async getPrintData(@Req() req: any, @Query('id') id: string) {
    return this.lckhService.getPrintData(id, this.getApiUser(req.user));
  }

  @Get('print/lembar-pengesahan')
  async getLembarPengesahanData(@Req() req: any, @Query('id') id: string) {
    return this.lckhService.getPrintData(id, this.getApiUser(req.user));
  }

  @Get('periods')
  async getPeriods() {
    const data = await this.lckhService.getPeriods();
    return { ok: true, data };
  }

  @Get('submissions')
  async getSubmissions(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.lckhService.getSubmissions(apiUser, query);
    return { ok: true, data };
  }

  @Get('summary')
  async getSummary(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.lckhService.getSummary(apiUser, query);
    return { ok: true, data };
  }

  @Get('submissions/:id')
  async getSubmissionById(@Req() req: any, @Param('id') id: string) {
    const data = await this.lckhService.getSubmissionById(id, this.getApiUser(req.user));
    return { ok: true, data };
  }

  @Post('submissions')
  async saveSubmission(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.lckhService.saveSubmission(apiUser, body);
    return { ok: true, data };
  }

  @Delete('submissions/:id')
  async deleteSubmission(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.lckhService.deleteSubmission(id, apiUser);
    return { ok: true, data };
  }

  @Get('approvals/:submissionId')
  async getApprovals(@Req() req: any, @Param('submissionId') submissionId: string) {
    const data = await this.lckhService.getApprovals(submissionId, this.getApiUser(req.user));
    return { ok: true, data };
  }

  @Post('approvals/:submissionId')
  async approveSubmission(
    @Req() req: any,
    @Param('submissionId') submissionId: string,
    @Body() body: any,
  ) {
    const apiUser = this.getApiUser(req.user);
    const data = await this.lckhService.approveSubmission(apiUser, submissionId, body);
    return { ok: true, data };
  }
}
