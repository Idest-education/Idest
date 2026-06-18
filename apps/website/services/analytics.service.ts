import { http } from "./http";

export interface UserMonthlyStat {
  month: string;
  STUDENT: number;
  TEACHER: number;
  ADMIN: number;
}

export interface ClassMonthlyStat {
  month: string;
  count: number;
}

export async function getUserMonthlyStats(): Promise<UserMonthlyStat[]> {
  try {
    const res = await http.get("/user/stats");
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function getClassMonthlyStats(): Promise<ClassMonthlyStat[]> {
  try {
    const res = await http.get("/class/stats");
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function getAssignmentCount(assignmentApiUrl: string, token: string): Promise<number> {
  try {
    const res = await fetch(`${assignmentApiUrl}/assignments?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      let total = 0;
      for (const key of Object.keys(data)) {
        const arr = data[key];
        if (Array.isArray(arr)) total += arr.length;
        else if (arr && typeof arr === "object" && "total" in arr) total += (arr as any).total ?? 0;
      }
      return total;
    }
    return 0;
  } catch {
    return 0;
  }
}
