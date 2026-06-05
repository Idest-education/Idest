import { http, unwrapResponse } from "./http";
import { TimelineResponse, QuestionTypesResponse, WritingRubricsResponse } from "@/types/progress";

const getAssignmentBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_ASSIGNMENT_API_URL || "http://localhost:8008";
  return baseUrl;
};

export async function getProgressTimeline(
  skill?: 'reading' | 'listening' | 'writing' | 'speaking' | 'overall',
  window?: '7d' | '30d' | '90d' | 'all',
): Promise<TimelineResponse> {
  const params: Record<string, string> = {};
  if (skill) params.skill = skill;
  if (window) params.window = window;

  const res = await http.get(`${getAssignmentBaseUrl()}/progress/me/timeline`, { params });
  return unwrapResponse<TimelineResponse>(res.data);
}

export async function getProgressQuestionTypes(
  skill: 'reading' | 'listening',
  window?: '7d' | '30d' | '90d' | 'all',
): Promise<QuestionTypesResponse> {
  const params: Record<string, string> = { skill };
  if (window) params.window = window;

  const res = await http.get(`${getAssignmentBaseUrl()}/progress/me/question-types`, { params });
  return unwrapResponse<QuestionTypesResponse>(res.data);
}

export async function getProgressWritingRubrics(
  window?: '7d' | '30d' | '90d' | 'all',
): Promise<WritingRubricsResponse> {
  const params: Record<string, string> = {};
  if (window) params.window = window;

  const res = await http.get(`${getAssignmentBaseUrl()}/progress/me/writing-rubrics`, { params });
  return unwrapResponse<WritingRubricsResponse>(res.data);
}
