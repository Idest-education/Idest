"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SessionPageRedirect() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.sessionId) {
      router.replace(`/sessions/${params.sessionId}/meet`);
    }
  }, [params, router]);

  return <div className="p-6 text-sm text-muted-foreground">Đang chuyển hướng đến buổi học...</div>;
}

