import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateWritingAssignmentDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  taskone: string;

  @ApiProperty()
  @IsString()
  tasktwo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  img?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imgDescription?: string;
}

