import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimAnakDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nisn: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tanggal_lahir_siswa: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status_keluarga: string;
}

export class AddRelasiDto {
  @ApiProperty()
  @IsNumber()
  user_id: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nisn: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status_keluarga: string;
}

export class UpdateRelasiDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status_keluarga: string;
}
