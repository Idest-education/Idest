"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MeetingRoom from "@/components/meeting/MeetingRoom";
import LoadingScreen from "@/components/loading-screen";

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      try {
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

        setToken(accessToken);
      } catch (err: any) {
        console.error("Error getting token:", err);
        setError(err.message || "Failed to authenticate");
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      getToken();
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

