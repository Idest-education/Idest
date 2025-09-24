import { ApiProperty } from '@nestjs/swagger';
import { Specialization } from 'src/common/enum/specialization.enum';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AssignmentResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsUUID()
  created_by: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  class_id?: string;

  @ApiProperty({ enum: Specialization })
  @IsEnum(Specialization)
  skill: Specialization;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsBoolean()
  is_public: boolean;

  @ApiProperty()
  @IsDate()
  created_at: Date;
}
