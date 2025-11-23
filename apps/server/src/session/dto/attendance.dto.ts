import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceRecordDto {
  @ApiProperty({ description: 'Attendance record ID' })
  id: string;

  @ApiProperty({ description: 'Session ID' })
  session_id: string;

  @ApiProperty({ description: 'User ID' })
  user_id: string;

  @ApiProperty({ description: 'Time when user joined the session' })
  joined_at: Date;

  @ApiPropertyOptional({ description: 'Time when user left the session' })
  left_at?: Date;

  @ApiPropertyOptional({
    description: 'Duration in seconds the user was in the session',
  })
  duration_seconds?: number;

  @ApiProperty({
    description: 'Whether the user has been marked as attended (after 5 minutes)',
    example: false,
  })
  is_attended: boolean;

  @ApiPropertyOptional({
    description: 'Time when user was marked as attended',
  })
  attended_at?: Date;

  @ApiPropertyOptional({ description: 'User details' })
  user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export class SessionAttendanceSummaryDto {
  @ApiProperty({ description: 'Session ID' })
  session_id: string;

  @ApiProperty({ description: 'Total number of attendees' })
  total_attendees: number;

  @ApiProperty({ description: 'Number of currently active attendees' })
  active_attendees: number;

  @ApiProperty({
    description: 'Number of attendees who stayed for 5+ minutes (marked as attended)',
  })
  attended_count: number;

  @ApiProperty({ description: 'Average attendance duration in seconds' })
  average_duration_seconds: number;

  @ApiProperty({ description: 'List of attendance records' })
  attendees: AttendanceRecordDto[];
}

