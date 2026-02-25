import axios from "axios";
import { createClient } from "@/lib/supabase/client";

export const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Thêm access token Supabase vào header mỗi khi gọi API
http.interceptors.request.use(async (config) => {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Unwraps the backend response envelope.
 * Backend wraps all responses in { status, message, data, statusCode } via SuccessEnvelopeInterceptor.
 * This helper extracts the `data` field consistently.
 */
export function unwrapResponse<T>(response: any): T {
  // Check if response is wrapped in envelope: { status, message, data, statusCode }
  if (response && typeof response === 'object' && 'status' in response && 'statusCode' in response && 'data' in response) {
    return response.data as T;
  }
  // If already unwrapped or different structure, return as-is
  return response as T;
}
