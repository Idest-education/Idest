import { http } from "./http";

export async function getClasses() {
  const res = await http.get("/class");
  return res.data;
}

export async function getClassById(id: string) {
  const res = await http.get(`/class/${id}`);
  return res.data;
}