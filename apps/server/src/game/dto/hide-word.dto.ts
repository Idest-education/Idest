import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HideWordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  word: string;
}
