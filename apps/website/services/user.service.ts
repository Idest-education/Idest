import { http } from "./http";
import type {
  UserProfile,
  UpdateUserProfileRequest,
  UserClassSummary,
} from "@/types/user";

interface UserApiData {
  id: string;
  full_name: string | null;
  email: string;
  role: "ADMIN" | "STUDENT" | "TEACHER";
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Optional class relations for admin user detail
  ClassesCreated?: Array<{
    id: string;
    name: string;
    slug?: string;
    invite_code?: string;
  }>;
  ClassTeachers?: Array<{
    id: string;
    class: {
      id: string;
      name: string;
      slug?: string;
      invite_code?: string;
    };
  }>;
  ClassMembers?: Array<{
    id: string;
    class: {
      id: string;
      name: string;
      slug?: string;
      invite_code?: string;
    };
  }>;
}

interface UserApiResponse {
  status: boolean;
  message: string;
  data: UserApiData;
  statusCode: number;
}

function mapUser(api: UserApiData): UserProfile {
  const created: UserClassSummary[] =
    api.ClassesCreated?.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      inviteCode: c.invite_code,
    })) ?? [];

  const teaching: UserClassSummary[] =
    api.ClassTeachers?.map((t) => ({
      id: t.class.id,
      name: t.class.name,
      slug: t.class.slug,
      inviteCode: t.class.invite_code,
    })) ?? [];

  const enrolled: UserClassSummary[] =
    api.ClassMembers?.map((m) => ({
      id: m.class.id,
      name: m.class.name,
      slug: m.class.slug,
      inviteCode: m.class.invite_code,
    })) ?? [];

  return {
    id: api.id,
    email: api.email,
    fullName: api.full_name,
    avatarUrl: api.avatar_url,
    role: api.role,
    isActive: api.is_active,
    createdAt: api.created_at,
    classes: { created, teaching, enrolled },
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
  const res = await http.get<{ status: boolean; message: string; data: { users: SearchUserSummary[]; total: number }; statusCode: number }>(
    `/user/search`,
    { params: { q } },
  );
  // backend wraps in { status, message, data: { users, total }, statusCode }
  return res.data.data.users ?? [];
}

// Admin functions
export interface GetAllUsersParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: string[];
}

export interface AllUsersResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export async function getAllUsers(params?: GetAllUsersParams): Promise<AllUsersResponse> {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.sortBy) queryParams.sortBy = params.sortBy;
  if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;
  if (params?.filter && params.filter.length > 0) {
    queryParams.filter = params.filter.join(",");
  }

  try {
    const res = await http.get<{ status: boolean; message: string; data: { users: UserApiData[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }; statusCode: number }>("/user/all", { params: queryParams });
    // Backend wraps responses in { status, message, data, statusCode }
    const backendData = res.data.data;
    // Map backend users to frontend format
    return {
      users: backendData.users.map(mapUser),
      total: backendData.total,
      page: backendData.page,
      limit: backendData.limit,
      totalPages: backendData.totalPages,
      hasMore: backendData.hasMore,
    };
  } catch (error: unknown) {
    // If 404, the endpoint might not exist or user doesn't have permission
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        console.error("User endpoint not found or access denied. Check if user has ADMIN role.");
        throw new Error("Endpoint not found. Ensure you have ADMIN role.");
      }
    }
    throw error;
  }
}

export async function banUser(id: string): Promise<boolean> {
  const res = await http.post<boolean>(`/user/ban/${id}`);
  return res.data;
}

export async function unbanUser(id: string): Promise<boolean> {
  const res = await http.post<boolean>(`/user/unban/${id}`);
  return res.data;
}

export async function getUserById(id: string): Promise<UserProfile> {
  const response = await http.get<UserApiResponse>(`/user/${id}`);
  return mapUser(response.data.data);
}


