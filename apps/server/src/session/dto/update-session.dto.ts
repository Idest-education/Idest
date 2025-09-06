import {
  IsBoolean,
  IsOptional,
  IsDateString,
  IsString,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSessionDto {
  @ApiPropertyOptional({
    description: 'Updated start time of the session',
    example: '2025-01-15T10:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @ApiPropertyOptional({
    description: 'Updated end time of the session',
    example: '2025-01-15T11:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  end_time?: string;

  @ApiPropertyOptional({
    description: 'Whether this session is being recorded',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_recorded?: boolean;

  @ApiPropertyOptional({
    description: 'URL to the session recording (if available)',
    example: 'https://storage.example.com/recordings/session-123.mp4',
    format: 'url',
  })
  @IsString()
  @IsOptional()
  recording_url?: string;

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
        { type: 'text', position: [50, 60], content: 'Example', size: 14 },
      ],
      background: 'white',
    },
  })
  @IsObject()
  @IsOptional()
  whiteboard_data?: any;

  @ApiPropertyOptional({
    description: 'Additional session metadata',
    example: {
      topic: 'IELTS Speaking Practice',
      attendees_count: 5,
      completed_activities: ['warm-up', 'part1', 'part2'],
    },
  })
  @IsObject()
  @IsOptional()
  metadata?: any;
}
