import { http } from "./http";

export interface UserRoleStat {
  role: string;
  count: number;
}

export interface SessionMonthStat {
  month: string;
  count: number;
}

export async function getUserRoleStats(): Promise<UserRoleStat[]> {
  try {
    const res = await http.get("/user/stats");
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function getSessionStats(): Promise<SessionMonthStat[]> {
  try {
    const res = await http.get("/session/stats");
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
    // The assignments API returns per-skill arrays; count total across all skills
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
