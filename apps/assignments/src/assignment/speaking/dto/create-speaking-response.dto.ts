import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber } from 'class-validator';

export class CreateSpeakingResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  assignment_id: string;

  @ApiProperty()
  @IsString()
  user_id: string;

  @ApiProperty()
  @IsNumber()
  part_number: number;

  @ApiProperty()
  @IsString()
  audio_url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript?: string;

}


