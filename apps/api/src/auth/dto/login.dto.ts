import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@icgowa.sch.id', description: 'Email atau Username' })
  @IsNotEmpty({ message: 'Email/Username tidak boleh kosong' })
  @IsString()
  usernameOrEmail: string;

  @ApiProperty({ example: 'password123', description: 'Kata Sandi' })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString()
  password: string;
}
