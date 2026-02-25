import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAssignmentDto, CreateSectionDto } from '../../dto/create-assignment.dto';

export class CreateListeningAssignmentDto extends CreateAssignmentDto {
  @ApiProperty({ enum: ['listening'] })
  @IsEnum(['listening'])
  declare skill: 'listening';

  @ApiProperty({ type: [CreateSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  declare sections: CreateSectionDto[];
}


