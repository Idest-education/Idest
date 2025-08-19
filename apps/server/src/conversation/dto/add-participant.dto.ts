import { IsNotEmpty, IsString } from "class-validator";

export class AddParticipantDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
