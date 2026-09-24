import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AccessModule } from '../access/access.module';
import { EmailService } from '../common/email.service';

@Module({
  imports: [
    forwardRef(() => AccessModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        // Sengaja TIDAK ada nilai cadangan: secret bawaan yang ikut terbaca di
        // repo membuat siapa pun bisa menempa token admin bila env-nya lupa
        // diisi. Lebih baik gagal saat start daripada diam-diam tidak aman.
        if (!secret) {
          throw new Error(
            'JWT_SECRET belum diset. Isi di backend/.env dengan nilai yang SAMA PERSIS dengan JWT_SECRET di frontend/.env.local.',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, EmailService],
  exports: [AuthService, JwtStrategy, JwtAuthGuard, PassportModule, JwtModule],
})
export class AuthModule {}
