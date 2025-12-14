import { http } from "./http";
import type {
  UserProfile,
  StudentProfile,
  CreateStudentProfileRequest,
  UpdateUserProfileRequest,
} from "@/types/user";

interface StudentProfileApi {
  id: string;
  target_score: number;
  current_level: string;
  created_at: string;
}

interface UserApiData {
  id: string;
  full_name: string | null;
  email: string;
  role: "ADMIN" | "STUDENT" | "TEACHER";
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  StudentProfile?: StudentProfileApi | null;
}

interface UserApiResponse {
  status: boolean;
  message: string;
  data: UserApiData;
  statusCode: number;
}

function mapStudentProfile(api: StudentProfileApi): StudentProfile {
  return {
    id: api.id,
    targetScore: api.target_score,
    currentLevel: api.current_level,
    createdAt: api.created_at,
  };
}

function mapUser(api: UserApiData): UserProfile {
  return {
    id: api.id,
    email: api.email,
    fullName: api.full_name,
    avatarUrl: api.avatar_url,
    role: api.role,
    isActive: api.is_active,
    createdAt: api.created_at,
    studentProfile: api.StudentProfile ? mapStudentProfile(api.StudentProfile) : null,
  };
}

export async function getCurrentUser(): Promise<UserProfile> {
  const response = await http.get<UserApiResponse>("/user");
  return mapUser(response.data.data);
}

export async function updateUserProfile(
  id: string,
  payload: UpdateUserProfileRequest,
): Promise<UserProfile> {
  const response = await http.put<UserApiResponse>(`/user/${id}`, payload);
  return mapUser(response.data.data);
}

export async function deleteOwnAccount(): Promise<boolean> {
  const response = await http.delete<boolean>("/user/me");
  return response.data;
}

export async function createStudentProfile(
  payload: CreateStudentProfileRequest,
): Promise<StudentProfile> {
  const response = await http.post<StudentProfile>("/user/student-profile", payload);
  return response.data;
}

export interface SearchUserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role: "ADMIN" | "STUDENT" | "TEACHER" | string;
}

export async function searchUsers(query: string): Promise<SearchUserSummary[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await http.get<{ data?: any; users?: SearchUserSummary[] }>(
    `/user/search`,
    { params: { q } },
  );
  // backend wraps in { users, total }
  return (res.data as any)?.users ?? (res.data as any)?.data?.users ?? [];
}


