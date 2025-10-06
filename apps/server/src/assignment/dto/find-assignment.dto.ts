import { IsString, IsOptional, IsEnum } from 'class-validator';
import { SkillType } from './create-assignment.dto';

export class FindAssignmentDto {
  @IsOptional()
  @IsEnum(SkillType)
  skill?: SkillType;

  @IsOptional()
  @IsString()
  id?: string;
}
