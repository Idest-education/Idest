import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConversationDto {
  @ApiPropertyOptional({
    description: 'Updated title for the conversation (group chats only)',
    example: 'New Group Name',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated avatar URL for the conversation (group chats only)',
    example: 'https://example.com/group-avatar.png',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  avatar_url?: string;
}
