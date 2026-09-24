import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'admin@icgowa.sch.id', description: 'Email atau Username' })
  @Transform(({ obj }) => (obj.usernameOrEmail || obj.username || obj.email || '').toString().trim())
  @IsNotEmpty({ message: 'Email/Username tidak boleh kosong' })
  @IsString()
  usernameOrEmail: string;

  @ApiProperty({ example: 'password123', description: 'Kata Sandi' })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString()
  password: string;
}
