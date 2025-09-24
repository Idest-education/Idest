import { ApiPropertyOptional } from '@nestjs/swagger';
import { Specialization } from 'src/common/enum/specialization.enum';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ enum: Specialization })
  @IsOptional()
  @IsEnum(Specialization)
  skill?: Specialization;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @ApiPropertyOptional({
    description: 'Optional class association; set null to detach',
  })
  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsUUID()
  class_id?: string | null;
}
