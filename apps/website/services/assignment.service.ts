import { http } from "./http";
import { ReadingAssignmentDetail,ReadingSubmissionPayload,ReadingSubmissionResult, } from "@/types/assignment";
import { WritingAssignmentDetail, WritingSubmissionPayload, WritingSubmissionResult, AssignmentResponse, AssignmentOverview, SpeakingAssignmentDetail,
  SpeakingSubmissionPayload,
  ListeningAssignmentDetail,
  ListeningSubmissionPayload,
  ListeningSubmissionResult,
  PaginationDto,
  PaginatedAssignmentResponse,} from "@/types/assignment";
import type {
  CreateReadingOrListeningAssignmentPayload,
  CreateSpeakingAssignmentPayload,
  CreateWritingAssignmentPayload,
  MySubmissionsResponse,
  Skill,
} from "@/types/assignment";

export async function getAssignments(pagination?: PaginationDto): Promise<AssignmentResponse> {
  const params = pagination ? { page: pagination.page, limit: pagination.limit } : {};
  const res = await http.get("https://ie-backend.fly.dev/hehe/assignments", { params });
  const data = res.data;

  // Helper to normalize response (handle both paginated and non-paginated)
  const normalizeResponse = (response: any, skill: string): AssignmentOverview[] | PaginatedAssignmentResponse => {
    // Check if it's a paginated response
    if (response && typeof response === 'object' && 'data' in response && 'pagination' in response) {
      const paginated = response as PaginatedAssignmentResponse;
      return {
        data: paginated.data.map((item: any) => ({ ...item, skill })),
        pagination: paginated.pagination,
      };
    }
    // Non-paginated array response
    const items = Array.isArray(response) ? response : [];
    return items.map((item: any) => ({ ...item, skill }));
  };

  return {
    reading: normalizeResponse(data.reading ?? [], "reading"),
    listening: normalizeResponse(data.listening ?? [], "listening"),
    writing: normalizeResponse(data.writing ?? [], "writing"),
    speaking: normalizeResponse(data.speaking ?? [], "speaking"),
  } as AssignmentResponse;
}

export async function getAssignmentsBySkill(
  skill: "reading" | "listening" | "writing" | "speaking",
  pagination?: PaginationDto
): Promise<PaginatedAssignmentResponse | AssignmentOverview[]> {
  const params = pagination ? { page: pagination.page, limit: pagination.limit } : {};
  const res = await http.get(`https://ie-backend.fly.dev/hehe/${skill}/assignments`, { params });
  const data = res.data?.data || res.data;

  // Check if it's a paginated response
  if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
    const paginated = data as PaginatedAssignmentResponse;
    return {
      data: paginated.data.map((item: any) => ({ ...item, skill })),
      pagination: paginated.pagination,
    };
  }

  // Non-paginated array response
  const items = Array.isArray(data) ? data : [];
  return items.map((item: any) => ({ ...item, skill }));
}

//Reading
export async function getReadingAssignment(
  id: string
): Promise<{ status: boolean; message: string; data: ReadingAssignmentDetail }> {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/reading/assignments/${id}`);
  return res.data;
}

export async function submitReading(
  payload: ReadingSubmissionPayload
): Promise<{ status: boolean; message: string; data: ReadingSubmissionResult }> {
  const res = await http.post("https://ie-backend.fly.dev/hehe/reading/submissions", payload);
  return res.data;
}

export async function getReadingSubmissionResult(id: string) {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/reading/submissions/${id}`);
  return res.data;
}


//Writing
export async function getWritingAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: WritingAssignmentDetail;
}> {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/writing/assignments/${id}`);
  return res.data;
}

export async function submitWriting(
  payload: WritingSubmissionPayload
): Promise<{
  status: boolean;
  message: string;
  data: WritingSubmissionResult;
}> {
  const res = await http.post("https://ie-backend.fly.dev/hehe/writing/submissions", payload);
  return res.data;
}

export async function getWritingSubmissionResult(
  submissionId: string
): Promise<{
  status: boolean;
  message: string;
  data: WritingSubmissionResult;
}> {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/writing/submissions/${submissionId}`);
  return res.data;
}


// Speaking
export async function getSpeakingAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: SpeakingAssignmentDetail;
}> {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/speaking/assignments/${id}`);
  return res.data;
}

export async function submitSpeaking(payload: SpeakingSubmissionPayload) {
  const form = new FormData();

  form.append("assignment_id", payload.assignment_id);
  form.append("user_id", payload.user_id);
  form.append("audioOne", payload.audioOne);
  form.append("audioTwo", payload.audioTwo);
  form.append("audioThree", payload.audioThree);

  const res = await http.post("https://ie-backend.fly.dev/hehe/speaking/responses", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function getSpeakingSubmissionResult(submissionId: string) {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/speaking/responses/${submissionId}`);
  return res.data;
}


// Listening
export async function getListeningAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: ListeningAssignmentDetail;
}> {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/listening/assignments/${id}`);
  return res.data;
}

export async function submitListening(
  payload: ListeningSubmissionPayload
): Promise<{
  status: boolean;
  message: string;
  data: ListeningSubmissionResult;
}> {
  const res = await http.post("https://ie-backend.fly.dev/hehe/listening/submissions", payload);
  return res.data;
}

export async function getListeningSubmissionResult(id: string) {
  const res = await http.get(`https://ie-backend.fly.dev/hehe/listening/submissions/${id}`);
  return res.data;
}

// =======================
// CREATE ASSIGNMENT
// =======================

export async function createReadingAssignment(payload: CreateReadingOrListeningAssignmentPayload) {
  const res = await http.post("https://ie-backend.fly.dev/hehe/reading/assignments", payload);
  return res.data;
}

export async function createListeningAssignment(payload: CreateReadingOrListeningAssignmentPayload) {
  const res = await http.post("https://ie-backend.fly.dev/hehe/listening/assignments", payload);
  return res.data;
}

export async function createWritingAssignment(payload: CreateWritingAssignmentPayload) {
  const res = await http.post("https://ie-backend.fly.dev/hehe/writing/assignments", payload);
  return res.data;
}

export async function createSpeakingAssignment(payload: CreateSpeakingAssignmentPayload) {
  const res = await http.post("https://ie-backend.fly.dev/hehe/speaking/assignments", payload);
  return res.data;
}

// =======================
// MY SUBMISSIONS
// =======================

export async function getMySubmissions(params: PaginationDto & { skill?: Skill }): Promise<MySubmissionsResponse> {
  const res = await http.get("https://ie-backend.fly.dev/hehe/assignments/submissions/me", {
    params: { page: params.page, limit: params.limit, skill: params.skill },
  });
  // backend returns the paginated object directly: { data: [...], pagination: {...} }
  return res.data;
}
