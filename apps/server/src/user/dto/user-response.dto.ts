import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from 'src/common/enum/role.enum';

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: '1111-1111-1111-1111',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  full_name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    enum: Role,
    description: 'Role of the user in the system',
    example: Role.STUDENT,
    enumName: 'Role',
  })
  role: Role;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image",
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  avatar_url?: string | null;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  is_active: boolean;

  @ApiPropertyOptional({
    description:
      'IDs of classes this user has purchased or been granted access to (e.g. via invite code).',
    example: ['class-uuid-1', 'class-uuid-2'],
    nullable: true,
  })
  purchases?: string[];

  @ApiProperty({
    description: 'Timestamp when the user was created',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Timestamp when the user was last updated',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  updated_at: Date;
}

export class BanUserResponseDto {
  @ApiProperty({
    description: 'Whether the ban operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result',
    example: 'User has been successfully banned',
  })
  message: string;
}
