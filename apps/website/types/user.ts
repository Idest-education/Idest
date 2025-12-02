export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "STUDENT" | "TEACHER";
  isActive: boolean;
  createdAt: string;
  studentProfile?: StudentProfile | null;
}

export interface StudentProfile {
  id: string;
  targetScore: number;
  currentLevel: string;
  createdAt: string;
}

export interface AllUserProfilesResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateStudentProfileRequest {
  targetScore: number;
  currentLevel: string;
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  role?: "ADMIN" | "STUDENT" | "TEACHER";
  avatar?: string | null;
  isActive?: boolean;
}


