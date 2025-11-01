import { http } from "./http";
import { CreateSessionPayload, UpdateSessionPayload } from "@/types/session";

/**
 * Get all sessions (for teachers and admins)
 */
export async function getAllSessions() {
  try {
    const res = await http.get("/session");
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}

/**
 * Get user's sessions (hosted, attended, and upcoming)
 */
export async function getUserSessions() {
  try {
    const res = await http.get("/session/user");
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}

export async function getUpcomingSessions() {
  const res = await http.get("/session/upcoming");
  return res.data;
}

export async function getSessionById(id: string) {
  const res = await http.get(`/session/${id}`);
  return res.data;
}

export async function getClassSessions(classId: string) {
  const res = await http.get(`/session/class/${classId}`);
  return res.data;
}

export async function createSession(payload: CreateSessionPayload) {
  try {
    const res = await http.post("/session", payload);
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}

export async function updateSession(id: string, payload: UpdateSessionPayload) {
  try {
    const res = await http.put(`/session/${id}`, payload);
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}

export async function endSession(id: string) {
  try {
    const res = await http.put(`/session/${id}/end`);
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}

export async function deleteSession(id: string) {
  try {
    const res = await http.delete(`/session/${id}`);
    return res.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw error;
  }
}
