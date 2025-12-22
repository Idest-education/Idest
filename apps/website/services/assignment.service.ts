import { http, unwrapResponse } from "./http";
import { ReadingAssignmentDetail, SubmitAssignmentV2Payload, SubmissionResultV2 } from "@/types/assignment";
import { WritingAssignmentDetail, WritingSubmissionPayload, WritingSubmissionResult, AssignmentResponse, AssignmentOverview, SpeakingAssignmentDetail,
  SpeakingSubmissionPayload,
  ListeningAssignmentDetail,
  SubmitAssignmentV2Payload,
  SubmissionResultV2,
  PaginationDto,
  PaginatedAssignmentResponse,} from "@/types/assignment";
import type {
  CreateReadingOrListeningAssignmentPayload,
  CreateSpeakingAssignmentPayload,
  CreateWritingAssignmentPayload,
  MySubmissionsResponse,
  Skill,
} from "@/types/assignment";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorResponseData(error: unknown): unknown | undefined {
  if (!isRecord(error)) return undefined;
  const response = error["response"];
  if (!isRecord(response)) return undefined;
  return response["data"];
}

const getAssignmentBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://ie-backend.fly.dev";
  return `${baseUrl}/hehe`;
};

export async function getAssignments(pagination?: PaginationDto): Promise<AssignmentResponse> {
  const params = pagination ? { page: pagination.page, limit: pagination.limit } : {};
  const res = await http.get(`${getAssignmentBaseUrl()}/assignments`, { params });
  const data = res.data;

  // Helper to normalize response (handle both paginated and non-paginated)
  const normalizeResponse = (
    response: unknown,
    skill: Skill,
  ): AssignmentOverview[] | PaginatedAssignmentResponse => {
    const withSkill = (item: unknown): AssignmentOverview => {
      if (isRecord(item)) {
        return ({ ...item, skill } as unknown) as AssignmentOverview;
      }
      return ({ skill } as unknown) as AssignmentOverview;
    };

    // Check if it's a paginated response
    if (response && typeof response === 'object' && 'data' in response && 'pagination' in response) {
      const paginated = response as PaginatedAssignmentResponse;
      const items = Array.isArray(paginated.data) ? paginated.data : [];
      return {
        data: items.map(withSkill),
        pagination: paginated.pagination,
      };
    }
    // Non-paginated array response
    const items = Array.isArray(response) ? response : [];
    return items.map(withSkill);
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
  const res = await http.get(`${getAssignmentBaseUrl()}/${skill}/assignments`, { params });
  const data = res.data?.data || res.data;

  const withSkill = (item: unknown): AssignmentOverview => {
    if (isRecord(item)) {
      return ({ ...item, skill } as unknown) as AssignmentOverview;
    }
    return ({ skill } as unknown) as AssignmentOverview;
  };

  // Check if it's a paginated response
  if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
    const paginated = data as PaginatedAssignmentResponse;
    return {
      data: (Array.isArray(paginated.data) ? paginated.data : []).map(withSkill),
      pagination: paginated.pagination,
    };
  }

  // Non-paginated array response
  const items = Array.isArray(data) ? data : [];
  return items.map(withSkill);
}

//Reading
export async function getReadingAssignment(
  id: string
): Promise<{ status: boolean; message: string; data: ReadingAssignmentDetail }> {
  const res = await http.get(`${getAssignmentBaseUrl()}/reading/assignments/${id}`);
  return res.data;
}

export async function submitReading(
  payload: SubmitAssignmentV2Payload
): Promise<{ status: boolean; message: string; data: SubmissionResultV2 }> {
  const res = await http.post(`${getAssignmentBaseUrl()}/reading/submissions`, payload);
  return res.data;
}

export async function getReadingSubmissionResult(id: string) {
  const res = await http.get(`${getAssignmentBaseUrl()}/reading/submissions/${id}`);
  return res.data;
}


//Writing
export async function getWritingAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: WritingAssignmentDetail;
}> {
  const res = await http.get(`${getAssignmentBaseUrl()}/writing/assignments/${id}`);
  return res.data;
}

export async function submitWriting(
  payload: WritingSubmissionPayload
): Promise<{
  status: boolean;
  message: string;
  data: WritingSubmissionResult;
}> {
  const res = await http.post(`${getAssignmentBaseUrl()}/writing/submissions`, payload);
  return res.data;
}

export async function getWritingSubmissionResult(
  submissionId: string
): Promise<{
  status: boolean;
  message: string;
  data: WritingSubmissionResult;
}> {
  const res = await http.get(`${getAssignmentBaseUrl()}/writing/submissions/${submissionId}`);
  return res.data;
}


// Speaking
export async function getSpeakingAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: SpeakingAssignmentDetail;
}> {
  const res = await http.get(`${getAssignmentBaseUrl()}/speaking/assignments/${id}`);
  return res.data;
}

export async function submitSpeaking(payload: SpeakingSubmissionPayload) {
  const form = new FormData();

  form.append("assignment_id", payload.assignment_id);
  form.append("user_id", payload.user_id);
  form.append("audioOne", payload.audioOne);
  form.append("audioTwo", payload.audioTwo);
  form.append("audioThree", payload.audioThree);

  const res = await http.post(`${getAssignmentBaseUrl()}/speaking/responses`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function getSpeakingSubmissionResult(submissionId: string) {
  const res = await http.get(`${getAssignmentBaseUrl()}/speaking/responses/${submissionId}`);
  return res.data;
}


// Listening
export async function getListeningAssignment(id: string): Promise<{
  status: boolean;
  message: string;
  data: ListeningAssignmentDetail;
}> {
  const res = await http.get(`${getAssignmentBaseUrl()}/listening/assignments/${id}`);
  return res.data;
}

export async function submitListening(
  payload: SubmitAssignmentV2Payload
): Promise<{
  status: boolean;
  message: string;
  data: SubmissionResultV2;
}> {
  const res = await http.post(`${getAssignmentBaseUrl()}/listening/submissions`, payload);
  return res.data;
}

export async function getListeningSubmissionResult(id: string) {
  const res = await http.get(`${getAssignmentBaseUrl()}/listening/submissions/${id}`);
  return res.data;
}

// =======================
// CREATE ASSIGNMENT
// =======================

export async function createReadingAssignment(payload: CreateReadingOrListeningAssignmentPayload) {
  const res = await http.post(`${getAssignmentBaseUrl()}/reading/assignments`, payload);
  return res.data;
}

export async function createListeningAssignment(payload: CreateReadingOrListeningAssignmentPayload) {
  const res = await http.post(`${getAssignmentBaseUrl()}/listening/assignments`, payload);
  return res.data;
}

export async function createWritingAssignment(payload: CreateWritingAssignmentPayload) {
  const res = await http.post(`${getAssignmentBaseUrl()}/writing/assignments`, payload);
  return res.data;
}

export async function createSpeakingAssignment(payload: CreateSpeakingAssignmentPayload) {
  const res = await http.post(`${getAssignmentBaseUrl()}/speaking/assignments`, payload);
  return res.data;
}

// =======================
// MY SUBMISSIONS
// =======================

export async function getMySubmissions(params: PaginationDto & { skill?: Skill }): Promise<MySubmissionsResponse> {
  const res = await http.get(`${getAssignmentBaseUrl()}/assignments/submissions/me`, {
    params: { page: params.page, limit: params.limit, skill: params.skill },
  });
  // backend returns the paginated object directly: { data: [...], pagination: {...} }
  return res.data;
}

// Admin functions
export async function getAllSubmissions(skill?: Skill): Promise<unknown> {
  const baseUrl = getAssignmentBaseUrl();
  try {
    if (skill) {
      const res = await http.get(`${baseUrl}/${skill}/submissions`);
      return unwrapResponse(res.data);
    }
    const res = await http.get(`${baseUrl}/assignments/submissions`);
    return unwrapResponse(res.data);
  } catch (error: unknown) {
    const responseData = getErrorResponseData(error);
    if (responseData) return unwrapResponse(responseData);
    throw error;
  }
}

export async function updateAssignment(
  skill: "reading" | "listening" | "writing" | "speaking",
  id: string,
  payload: Record<string, unknown>,
) {
  const res = await http.patch(`${getAssignmentBaseUrl()}/${skill}/assignments/${id}`, payload);
  return res.data;
}

export async function deleteAssignment(skill: "reading" | "listening" | "writing" | "speaking", id: string) {
  const res = await http.delete(`${getAssignmentBaseUrl()}/${skill}/assignments/${id}`);
  return res.data;
}
