import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ClassCalendarQueryDto {
  @ApiProperty({
    description: 'Start of calendar range (ISO-8601). Defaults to current time.',
    example: '2026-04-23T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description:
      'End of calendar range (ISO-8601). Defaults to 8 weeks after "from".',
    example: '2026-06-18T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ClassCalendarEventDto {
  @ApiProperty({
    description: 'Stable event id used by clients for rendering and caching.',
    example: 'session_9d16d43d-2f74-4faa-96d6-7a5e30275e1d',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Display title of the event.',
    example: 'IELTS Advanced',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Event start time (ISO-8601).',
    example: '2026-04-25T02:00:00.000Z',
  })
  @IsDateString()
  start: string;

  @ApiProperty({
    description: 'Event end time (ISO-8601).',
    example: '2026-04-25T03:30:00.000Z',
  })
  @IsDateString()
  end: string;

  @ApiProperty({
    description: 'Source of this calendar event.',
    enum: ['session', 'recurring'],
    example: 'session',
  })
  @IsEnum(['session', 'recurring'] as const)
  source: 'session' | 'recurring';

  @ApiProperty({
    description: 'Class id that owns this event.',
    example: '2db0a0af-41e8-43f2-8cd3-4d6f3d4e9953',
  })
  @IsString()
  classId: string;

  @ApiProperty({
    description: 'Class name that owns this event.',
    example: 'IELTS Advanced',
  })
  @IsString()
  className: string;

  @ApiProperty({
    description: 'Optional timezone from class schedule metadata.',
    example: 'Asia/Ho_Chi_Minh',
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string | null;
}

export class ClassCalendarEventsResponseDto {
  @ApiProperty({
    description: 'Range lower bound used to build events.',
    example: '2026-04-23T00:00:00.000Z',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'Range upper bound used to build events.',
    example: '2026-06-18T23:59:59.999Z',
  })
  @IsDateString()
  to: string;

  @ApiProperty({
    description: 'Total events returned after merge and dedupe.',
    example: 42,
  })
  total: number;

  @ApiProperty({
    description: 'Merged class calendar events.',
    type: [ClassCalendarEventDto],
  })
  @IsArray()
  events: ClassCalendarEventDto[];
}
