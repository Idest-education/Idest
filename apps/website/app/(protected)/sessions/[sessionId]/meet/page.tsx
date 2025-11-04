"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MeetingRoom from "@/components/meeting/MeetingRoom";
import LoadingScreen from "@/components/loading-screen";
import { getSessionById } from "@/services/session.service";

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAndGetToken = async () => {
      try {
        // First, get the authentication token
        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setError("Authentication required. Please log in.");
          router.push("/auth/login");
          return;
        }

        const accessToken = session.access_token;
        if (!accessToken) {
          setError("Unable to get access token.");
          return;
        }

        // Validate session exists and user has access
        try {
          const sessionResponse = await getSessionById(sessionId);
          
          if (!sessionResponse || sessionResponse.statusCode !== 200) {
            setError("Session not found or you don't have access to this session.");
            setTimeout(() => router.push("/sessions"), 2000);
            return;
          }

          const sessionData = sessionResponse.data;
          
          // Check if session has ended
          if (sessionData.end_time) {
            const endTime = new Date(sessionData.end_time);
            if (endTime < new Date()) {
              setError("This session has already ended.");
              setTimeout(() => router.push("/sessions"), 2000);
              return;
            }
          }

          // Check if session hasn't started yet (allow joining 5 minutes early)
          const startTime = new Date(sessionData.start_time);
          const now = new Date();
          const fiveMinutesEarly = new Date(startTime.getTime() - 5 * 60 * 1000);
          
          if (now < fiveMinutesEarly) {
            const minutesUntilStart = Math.ceil((fiveMinutesEarly.getTime() - now.getTime()) / (1000 * 60));
            setError(`Session hasn't started yet. You can join in ${minutesUntilStart} minutes.`);
            return;
          }

          // All validations passed
          setToken(accessToken);
        } catch (validationError: any) {
          console.error("Session validation error:", validationError);
          if (validationError.response?.status === 404) {
            setError("Session not found.");
          } else if (validationError.response?.status === 403) {
            setError("You don't have permission to join this session.");
          } else {
            setError("Failed to validate session access.");
          }
          setTimeout(() => router.push("/sessions"), 2000);
        }
      } catch (err: any) {
        console.error("Error in session validation:", err);
        setError(err.message || "Failed to authenticate");
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      validateAndGetToken();
    }
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="h-screen">
        <LoadingScreen />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/sessions")}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return <MeetingRoom sessionId={sessionId} token={token} />;
}

