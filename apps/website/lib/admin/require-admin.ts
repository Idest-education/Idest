"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  try {
    // Get user role from backend
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      redirect("/auth/login");
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://ie-backend.fly.dev";
    const response = await fetch(`${apiUrl}/user/role`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      redirect("/classes");
    }

    const data = await response.json();
    const role = data?.role || data?.data?.role;

    if (role !== "ADMIN") {
      redirect("/classes");
    }

    return { user, role };
  } catch (error) {
    console.error("Error checking admin role:", error);
    redirect("/classes");
  }
}

