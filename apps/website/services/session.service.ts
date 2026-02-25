import { http, unwrapResponse } from "./http";
import { 
  CreateSessionPayload, 
  UpdateSessionPayload, 
  PaginationDto,
  PaginationMeta,
  PaginatedResponse,
  SessionData
} from "@/types/session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorResponseData(error: unknown): unknown | undefined {
  if (!isRecord(error)) return undefined;
  const response = error["response"];
  if (!isRecord(response)) return undefined;
  return response["data"];
}

function isPaginationMeta(value: unknown): value is PaginationMeta {
  if (!isRecord(value)) return false;
  return (
    typeof value["page"] === "number" &&
    typeof value["limit"] === "number" &&
    typeof value["total"] === "number" &&
    typeof value["totalPages"] === "number" &&
    typeof value["hasNext"] === "boolean" &&
    typeof value["hasPrev"] === "boolean"
  );
}

/**
 * Get all sessions (for teachers and admins)
 */
export async function getAllSessions(pagination?: PaginationDto) {
  const fallbackPagination = {
    page: pagination?.page ?? 1,
    limit: pagination?.limit ?? 8,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  try {
    const res = await http.get("/session", { params: pagination });
    const unwrapped = unwrapResponse<unknown>(res.data);

    // The backend has historically returned multiple shapes. Normalize to:
    // { data: SessionData[]; pagination: PaginationMeta }
    //
    // Supported shapes:
    // A) envelope -> { data: Session[], pagination }
    // B) envelope -> { data: { data: Session[], pagination } }  (extra nesting)
    // C) envelope -> Session[]                               (non-paginated)
    const normalize = (raw: unknown): PaginatedResponse<SessionData> => {
      if (!raw) return { data: [], pagination: fallbackPagination };

      // Shape A
      if (isRecord(raw)) {
        const data = raw["data"];
        const paginationMeta = raw["pagination"];
        if (Array.isArray(data) && paginationMeta) {
          return {
            data: data as SessionData[],
            pagination: isPaginationMeta(paginationMeta) ? paginationMeta : fallbackPagination,
          };
        }
      }

      // Shape B
      if (isRecord(raw)) {
        const nested = raw["data"];
        if (isRecord(nested)) {
          const nestedData = nested["data"];
          const nestedPagination = nested["pagination"];
          if (Array.isArray(nestedData) && nestedPagination) {
            return {
              data: nestedData as SessionData[],
              pagination: isPaginationMeta(nestedPagination) ? nestedPagination : fallbackPagination,
            };
          }
        }
      }

      // Shape C
      if (Array.isArray(raw)) {
        return {
          data: raw as SessionData[],
          pagination: {
            ...fallbackPagination,
            total: raw.length,
            totalPages: 1,
          },
        };
      }

      console.warn("[getAllSessions] Unexpected response structure:", raw);
      return { data: [], pagination: fallbackPagination };
    };

    return normalize(unwrapped);
  } catch (error: unknown) {
    console.error("[getAllSessions] Error:", error);
    const responseData = getErrorResponseData(error);
    if (responseData) {
      const unwrapped = unwrapResponse<unknown>(responseData);
      // Keep return type stable even on error envelopes
      if (unwrapped) {
        if (isRecord(unwrapped)) {
          const data = unwrapped["data"];
          const paginationMeta = unwrapped["pagination"];
          if (Array.isArray(data) && paginationMeta) {
            return {
              data: data as SessionData[],
              pagination: isPaginationMeta(paginationMeta) ? paginationMeta : fallbackPagination,
            };
          }

          const nested = unwrapped["data"];
          if (isRecord(nested)) {
            const nestedData = nested["data"];
            const nestedPagination = nested["pagination"];
            if (Array.isArray(nestedData) && nestedPagination) {
              return {
                data: nestedData as SessionData[],
                pagination: isPaginationMeta(nestedPagination) ? nestedPagination : fallbackPagination,
              };
            }
          }
        }
      }
    }
    throw error;
  }
}

/**
 * Get user's sessions (hosted, attended, and upcoming)
 */
export async function getUserSessions(pagination?: PaginationDto) {
  try {
    const res = await http.get("/session/user", { params: pagination });
    return res.data;
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return responseData;
    throw error;
  }
}

export async function getUpcomingSessions() {
  const res = await http.get("/session/upcoming");
  return res.data;
}

export async function getSessionById(id: string) {
  const res = await http.get(`/session/${id}`);
  return unwrapResponse(res.data);
}

export async function getClassSessions(classId: string, pagination?: PaginationDto) {
  const res = await http.get(`/session/class/${classId}`, { params: pagination });
  return res.data;
}

export async function createSession(payload: CreateSessionPayload) {
  try {
    const res = await http.post("/session", payload);
    return res.data;
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return responseData;
    throw error;
  }
}

export async function updateSession(id: string, payload: UpdateSessionPayload) {
  try {
    const res = await http.put(`/session/${id}`, payload);
    return res.data;
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return responseData;
    throw error;
  }
}

export async function endSession(id: string) {
  try {
    const res = await http.put(`/session/${id}/end`);
    return unwrapResponse(res.data);
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return unwrapResponse(responseData);
    throw error;
  }
}

export async function deleteSession(id: string) {
  try {
    const res = await http.delete(`/session/${id}`);
    return res.data;
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return responseData;
    throw error;
  }
}

// Attendance Methods

export async function getSessionAttendance(sessionId: string) {
  try {
    const res = await http.get(`/session/${sessionId}/attendance`);
    return unwrapResponse(res.data);
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return unwrapResponse(responseData);
    throw error;
  }
}

export async function getUserAttendance(pagination?: PaginationDto) {
  try {
    const res = await http.get("/session/user/attendance", { params: pagination });
    return res.data;
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return responseData;
    throw error;
  }
}
