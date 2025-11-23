export interface SessionHost {
  id: string;
  full_name: string;
  email: string;
}

export interface SessionClass {
  id: string;
  name: string;
}

export interface SessionMetadata {
  topic?: string;
  attendees_count?: number;
  [key: string]: any;
}

export interface AttendanceRecordDto {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  duration_seconds?: number;
  is_attended: boolean;
  attended_at?: string;
  user?: SessionHost; // Reuse SessionHost for user info as it has similar fields
}

export interface SessionAttendanceSummaryDto {
  session_id: string;
  total_attendees: number;
  active_attendees: number;
  attended_count: number;
  average_duration_seconds: number;
  attendees: AttendanceRecordDto[];
}

export interface SessionData {
  id: string;
  class_id: string;
  host_id: string;
  start_time: string;
  end_time: string | null;
  is_recorded: boolean;
  recording_url?: string | null;
  whiteboard_data?: any | null;
  metadata?: SessionMetadata | null;
  class: SessionClass;
  host: SessionHost;
  attendance_summary?: SessionAttendanceSummaryDto;
}

export interface CreateSessionPayload {
  class_id: string;
  start_time: string;
  end_time?: string;
  is_recorded?: boolean;
  metadata?: SessionMetadata;
}

export interface UpdateSessionPayload {
  start_time?: string;
  end_time?: string;
  is_recorded?: boolean;
  recording_url?: string;
  whiteboard_data?: any;
  metadata?: SessionMetadata;
}

export interface PaginationDto {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface SessionResponse {
  status: string;
  message: string;
  data: SessionData | SessionData[] | PaginatedResponse<SessionData>;
  statusCode: number;
}

/**
 * User sessions response structure
 * Contains hosted, attended, and upcoming sessions
 */
export interface UserSessionsResponse {
  status: string;
  message: string;
  data: {
    hosted?: PaginatedResponse<SessionData> | SessionData[];
    attended?: PaginatedResponse<SessionData> | SessionData[];
    upcoming?: SessionData[]; // Upcoming is not paginated
  };
  statusCode: number;
}
