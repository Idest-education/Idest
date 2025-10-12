import { http } from "./http";
import { CreateClassPayload } from "@/types/class";

export async function getClasses() {
  const res = await http.get("/class");
  return res.data;
}

export async function getClassById(id: string) {
  const res = await http.get(`/class/${id}`);
  return res.data;
}

export const searchClasses = async (q: string) => {
  if (!q.trim()) return [];
  const res = await http.get(`/class/search?q=${encodeURIComponent(q)}`);
  return res.data;
};

export const createClass = async (payload: CreateClassPayload) => {
  try {
    const res = await http.post("/class", payload);
    return res.data; // { status, message, data, statusCode }
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
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
