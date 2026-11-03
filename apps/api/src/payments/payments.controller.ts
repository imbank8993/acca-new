import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommitteeService } from './committee.service';
import { PaymentReportsService } from './payment-reports.service';
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
 constructor(private committee:CommitteeService,private reports:PaymentReportsService){}
 @Get('committee') list(@Req() req:any){return this.committee.list(req.user);}
 @Get('committee/detail') detail(@Req() req:any,@Query('id') id:string){return this.committee.detail(req.user,id);}
 @Post('committee') save(@Req() req:any,@Body() body:any){return this.committee.save(req.user,body);}
 @Post('proof') updateProof(@Req() req:any,@Body() body:any){return this.reports.updateProof(req.user,body);}
 @Get('report') report(@Req() req:any,@Query() query:any){return this.reports.report(req.user,query);}
 @Get('report-proof') async proof(@Req() req:any,@Query('id') id:string,@Res() res:any){const p=await this.reports.proof(req.user,id);res.set({'Content-Type':p.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.send(p.image);}
}
