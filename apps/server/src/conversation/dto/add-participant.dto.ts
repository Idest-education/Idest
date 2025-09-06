import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipantDto {
  @ApiProperty({
    description: 'ID of the user to add as a participant to the conversation',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
