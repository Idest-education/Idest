import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { SkillType } from './create-assignment.dto';

export class DeleteAssignmentDto {
  @IsOptional()
  @IsEnum(SkillType)
  skill?: SkillType;

  @IsString()
  @IsNotEmpty()
  id: string;
}
