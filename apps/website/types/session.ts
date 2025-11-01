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

export interface SessionResponse {
  status: string;
  message: string;
  data: SessionData | SessionData[];
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
    hosted?: SessionData[];
    attended?: SessionData[];
    upcoming?: SessionData[];
  };
  statusCode: number;
}

