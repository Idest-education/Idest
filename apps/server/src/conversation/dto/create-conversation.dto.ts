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
  participantIds: string[]; // Array of user IDs to add to conversation
}

export class AddParticipantDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
