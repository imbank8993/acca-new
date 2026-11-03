import { Body,Controller,Get,Param,Post,Req,UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentVerificationsService } from './payment-verifications.service';
@Controller('payments/report-verifications')
export class PaymentVerificationsController{
 constructor(private service:PaymentVerificationsService){}
 @Post() @UseGuards(JwtAuthGuard)
 register(@Req() req:any,@Body() body:any){return this.service.register(req.user,body);}
 @Get(':token')
 verify(@Param('token') token:string){return this.service.verify(token);}
}
