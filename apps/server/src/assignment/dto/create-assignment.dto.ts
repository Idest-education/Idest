import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Specialization } from 'src/common/enum/specialization.enum';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ enum: Specialization })
  @IsEnum(Specialization)
  skill!: Specialization;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty()
  @IsBoolean()
  is_public!: boolean;

  @ApiPropertyOptional({ description: 'Optional class association' })
  @IsOptional()
  @IsUUID()
  class_id?: string;
}
