export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "STUDENT" | "TEACHER";
  isActive: boolean;
  createdAt: string;
  classes?: {
    created: UserClassSummary[];
    teaching: UserClassSummary[];
    enrolled: UserClassSummary[];
  };
}

export interface UserClassSummary {
  id: string;
  name: string;
  slug?: string;
  inviteCode?: string;
}

export interface AllUserProfilesResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  role?: "ADMIN" | "STUDENT" | "TEACHER";
  avatar?: string | null;
  isActive?: boolean;
}


