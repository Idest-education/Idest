import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, ValidateNested, IsArray, ValidateIf, IsEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAssignmentDto, CreateSectionDto } from '../../dto/create-assignment.dto';

export class CreateReadingAssignmentDto extends CreateAssignmentDto {
  @ApiProperty({ enum: ['reading'] })
  @IsEnum(['reading'])
  declare skill: 'reading';

  @ApiProperty({ type: [CreateSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  declare sections: CreateSectionDto[];
}


