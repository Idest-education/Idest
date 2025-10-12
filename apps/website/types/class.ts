export interface ClassData {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  creator: {
    full_name: string;
    email: string;
    role: string;
  };
  _count: {
    members: number;
    teachers: number;
    sessions: number;
  };
  // schedule: {
  //   days: string[];
  //   time: string;
  //   duration: number;
  //   timezone: string;
  // };
}

export interface ClassResponse {
  created: ClassData[];
  teaching: ClassData[];
  enrolled: ClassData[];
}

// Chi tiết 1 class (GET /class/{id})
export interface ClassDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_group: boolean;
  invite_code: string;
  created_by: string;
  schedule: {
    days: string[];
    time: string;
    duration: number;
  };
  creator: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  };
  _count: {
    members: number;
    teachers: number;
    sessions: number;
  };
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  }>;
  teachers: Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  }>;
  sessions: Array<{
    id: string;
    class_id: string;
    host_id: string;
    start_time: string;
    end_time: string;
    is_recorded: boolean;
    recording_url?: string;
    whiteboard_data?: any;
    metadata?: {
      topic?: string;
      attendees_count?: number;
    };
    class: {
      id: string;
      name: string;
    };
    host: {
      id: string;
      full_name: string;
      email: string;
    };
  }>;
}

export interface ScheduleData {
  days: string[];
  time: string;
  duration: number;
  timezone?: string;
  recurring?: boolean;
}

export interface CreateClassPayload {
  name: string;
  description?: string;
  is_group: boolean;
  schedule?: ScheduleData;
  invite_code?: string;
}
