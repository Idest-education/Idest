import {
  IsBoolean,
  IsOptional,
  IsArray,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class CreateConversationDto {
  @IsBoolean()
  @IsOptional()
  isGroup?: boolean = false;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  participantIds: string[];

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;
}
