import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessController, AccessInternalController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AccessController, AccessInternalController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
