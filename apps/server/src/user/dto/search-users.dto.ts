import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchUserSummaryDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    nullable: true,
    required: false,
  })
  @IsOptional()
  avatar_url?: string | null;

  @ApiProperty({ example: 'STUDENT' })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class SearchUsersResponseDto {
  @ApiProperty({ type: [SearchUserSummaryDto] })
  @IsArray()
  users: SearchUserSummaryDto[];

  @ApiProperty({ example: 3 })
  total: number;
}





