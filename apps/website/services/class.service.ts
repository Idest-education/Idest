import { http, unwrapResponse } from "./http";
import { CreateClassPayload, ClassResponse, ClassData } from "@/types/class";

export async function getClasses(): Promise<{ data: ClassResponse }> {
  const res = await http.get("/class");
  return res.data;
}

// Alias for clarity in places where we care about the semantic meaning
export const getUserClasses = getClasses;

export async function getClassById(id: string) {
  const res = await http.get(`/class/${id}`);
  return unwrapResponse(res.data);
}

export async function getClassBySlug(slug: string) {
  const res = await http.get(`/class/slug/${slug}`);
  return res.data;
}

export const searchClasses = async (q: string) => {
  if (!q.trim()) return [];
  const res = await http.get(`/class/search?q=${encodeURIComponent(q)}`);
  return res.data;
};

// Get all visible classes for the current user (including those not yet enrolled),
// without requiring a non-empty search term.
export const getAllVisibleClasses = async (): Promise<ClassData[]> => {
  const res = await http.get("/class/search?q=");
  // API typically wraps payload in { data, ... }
  return res.data?.data || [];
};

export const createClass = async (payload: CreateClassPayload) => {
  try {
    const res = await http.post("/class", payload);
    return unwrapResponse(res.data);
  } catch (error: any) {
    if (error.response?.data) return unwrapResponse(error.response.data);
    throw error;
  }
};

export const joinClass = async (invite_code: string) => {
  try {
    const res = await http.post("/class/join", { invite_code });
    return res.data; // { status, message, data, statusCode }
  } catch (error: any) {
    // Nếu server trả lỗi (vd: code sai, class không tồn tại,...)
    if (error.response?.data) return error.response.data;
    throw error;
  }
};

// Admin functions
export interface GetAllClassesParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: "name" | "created_at" | "updated_at";
  sortOrder?: "asc" | "desc";
  creatorId?: string;
}

export interface PaginatedClassResponse {
  data: ClassData[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function getAllClasses(params?: GetAllClassesParams): Promise<PaginatedClassResponse> {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.q) queryParams.q = params.q;
  if (params?.sortBy) queryParams.sortBy = params.sortBy;
  if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;
  if (params?.creatorId) queryParams.creatorId = params.creatorId;

  type BackendPaginatedClassesPayload = {
    data: ClassData[];
    total: number;
    totalPages: number;
    page: number;
    pageSize: number;
  };

  try {
    const res = await http.get<{
      status: boolean;
      message: string;
      data: BackendPaginatedClassesPayload | PaginatedClassResponse;
      statusCode: number;
    }>("/class/all", { params: queryParams });

    const payload = res.data.data;

    // New backend shape: { data: [...], total, totalPages, page, pageSize }
    if (payload && typeof payload === "object" && "pageSize" in payload && "totalPages" in payload && "total" in payload) {
      const p = payload as BackendPaginatedClassesPayload;
      return {
        data: Array.isArray(p.data) ? p.data : [],
        pagination: {
          page: p.page ?? (params?.page ?? 1),
          pageSize: p.pageSize ?? (params?.pageSize ?? 8),
          total: p.total ?? 0,
          totalPages: p.totalPages ?? 0,
          hasNext: (p.page ?? 1) < (p.totalPages ?? 0),
          hasPrev: (p.page ?? 1) > 1,
        },
      };
    }

    // Old/other shape already normalized
    if (payload && typeof payload === "object" && "data" in payload && "pagination" in payload) {
      return payload as PaginatedClassResponse;
    }

    return {
      data: [],
      pagination: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 8,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  } catch (error: unknown) {
    // If 404, the endpoint might not exist or user doesn't have permission
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        console.error("Class endpoint not found or access denied. Check if user has ADMIN role.");
        throw new Error("Endpoint not found. Ensure you have ADMIN role.");
      }
    }
    throw error;
  }
}

export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
}

export async function getClassMembers(classId: string): Promise<UserSummary[]> {
  const res = await http.get(`/class/${classId}/members`);
  const data = res.data;
  // Handle both wrapped and unwrapped responses
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

export async function getClassTeachers(classId: string): Promise<UserSummary[]> {
  const res = await http.get(`/class/${classId}/teachers`);
  const data = res.data;
  // Handle both wrapped and unwrapped responses
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

export async function regenerateInviteCode(classId: string): Promise<string> {
  const res = await http.put(`/class/${classId}/regenerate-code`);
  const data = res.data;
  // Handle both wrapped and unwrapped responses
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && 'data' in data && typeof data.data === 'string') {
    return data.data;
  }
  return "";
}

export async function addStudentToClass(classId: string, studentId: string) {
  const res = await http.post(`/class/${classId}/students`, { student_id: studentId });
  return res.data;
}

export async function removeStudentFromClass(classId: string, studentId: string) {
  const res = await http.delete(`/class/${classId}/students/${studentId}`);
  return res.data;
}

export async function bulkAddStudents(classId: string, studentIds: string[]) {
  const res = await http.post(`/class/${classId}/students/bulk`, { student_ids: studentIds });
  return res.data;
}

export async function bulkRemoveStudents(classId: string, studentIds: string[]) {
  const res = await http.delete(`/class/${classId}/students/bulk`, {
    data: { student_ids: studentIds },
  });
  return res.data;
}

export async function updateClassAdmin(
  classId: string,
  payload: { name?: string; description?: string; is_group?: boolean },
) {
  const res = await http.put(`/class/${classId}`, payload);
  return unwrapResponse(res.data);
}

export async function deleteClassAdmin(classId: string) {
  const res = await http.delete(`/class/${classId}`);
  return res.data;
}

