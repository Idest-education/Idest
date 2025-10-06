import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber } from 'class-validator';

export class CreateSpeakingResponseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  assignment_id: string;

  @ApiProperty()
  @IsString()
  user_id: string;

  @ApiProperty()
  @IsString()
  audio_url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcriptOne?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcriptTwo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcriptThree?: string;

}


