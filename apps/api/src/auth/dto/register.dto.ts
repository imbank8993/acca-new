import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'imran@icgowa.sch.id', description: 'Email Pengguna' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'imran', description: 'Username Unik' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'Imran Syahrani', description: 'Nama Lengkap' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'password123', description: 'Kata Sandi Minimal 6 Karakter' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ example: 'admin', description: 'Role Pengguna', required: false })
  @IsOptional()
  @IsString()
  role?: string;
}
