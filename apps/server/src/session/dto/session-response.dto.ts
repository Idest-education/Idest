import {
  IsString,
  IsBoolean,
  ValidateNested,
  IsDate,
  IsOptional,
  IsJSON,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JsonValue } from '@prisma/client/runtime/library';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassInfoDto {
  @ApiProperty({
    description: 'Unique identifier for the class',
    example: 'class-uuid-here',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Name of the class',
    example: 'IELTS Preparation - Advanced Level',
  })
  @IsString()
  name: string;
}

export class HostInfoDto {
  @ApiProperty({
    description: 'Unique identifier for the session host',
    example: 'user-uuid-here',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Full name of the session host',
    example: 'Dr. Jane Smith',
  })
  @IsString()
  full_name: string;

  @ApiProperty({
    description: 'Email address of the session host',
    example: 'jane.smith@example.com',
    format: 'email',
  })
  @IsString()
  email: string;
}

export class SessionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the session',
    example: 'session-uuid-here',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'ID of the class this session belongs to',
    example: 'class-uuid-here',
  })
  @IsString()
  class_id: string;

  @ApiProperty({
    description: 'ID of the user hosting this session',
    example: 'user-uuid-here',
  })
  @IsString()
  host_id: string;

  @ApiProperty({
    description: 'Start time of the session',
    example: '2025-01-15T10:00:00.000Z',
    format: 'date-time',
  })
  @IsDate()
  start_time: Date;

  @ApiPropertyOptional({
    description: 'End time of the session (null if session is ongoing)',
    example: '2025-01-15T11:30:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @IsDate()
  @IsOptional()
  end_time: Date | null;

  @ApiProperty({
    description: 'Whether this session is being recorded',
    example: false,
  })
  @IsBoolean()
  is_recorded: boolean;

  @ApiPropertyOptional({
    description: 'URL to the session recording (if available)',
    example: 'https://storage.example.com/recordings/session-123.mp4',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  recording_url: string | null;

  @ApiPropertyOptional({
    description: 'Whiteboard data and drawings from the session',
    example: {
      drawings: [
        {
          type: 'line',
          coordinates: [
            [10, 20],
            [30, 40],
          ],
          color: 'red',
        },
      ],
      background: 'white',
    },
    nullable: true,
  })
  @IsJSON()
  @IsOptional()
  whiteboard_data: JsonValue | null;

  @ApiPropertyOptional({
    description: 'Additional session metadata',
    example: {
      topic: 'IELTS Speaking Practice',
      attendees_count: 5,
    },
    nullable: true,
  })
  @IsJSON()
  @IsOptional()
  metadata: JsonValue | null;

  @ApiProperty({
    description: 'Information about the class this session belongs to',
    type: () => ClassInfoDto,
  })
  @ValidateNested()
  @Type(() => ClassInfoDto)
  class: ClassInfoDto;

  @ApiProperty({
    description: 'Information about the session host',
    type: () => HostInfoDto,
  })
  @ValidateNested()
  @Type(() => HostInfoDto)
  host: HostInfoDto;
}
