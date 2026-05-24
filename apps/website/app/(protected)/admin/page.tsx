import { requireAdmin } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Users, GraduationCap, Video } from "lucide-react";

async function getStats() {
  const supabase = await createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://ie-backend.fly.dev";

  if (!token) {
    return { users: 0, classes: 0, sessions: 0 };
  }

  try {
    const [usersRes, classesRes, sessionsRes] = await Promise.all([
      fetch(`${apiUrl}/user/all?page=1&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/class/all?page=1&pageSize=1`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/session?page=1&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null),
    ]);

    return {
      users: usersRes?.data?.total || usersRes?.total || 0,
      classes: classesRes?.data?.total || classesRes?.total || 0,
      sessions: sessionsRes?.data?.pagination?.total || sessionsRes?.pagination?.total || 0,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { users: 0, classes: 0, sessions: 0 };
  }
}

export default async function AdminDashboard() {
  await requireAdmin();
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            fontSize: 26,
            color: "var(--color-text-primary)",
          }}
        >
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Overview of system statistics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: stats.users, icon: <Users className="w-5 h-5" style={{ color: "var(--color-brand)" }} /> },
          { label: "Total Classes", value: stats.classes, icon: <GraduationCap className="w-5 h-5" style={{ color: "var(--color-brand)" }} /> },
          { label: "Total Sessions", value: stats.sessions, icon: <Video className="w-5 h-5" style={{ color: "var(--color-brand)" }} /> },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--color-surface-subtle)" }}
              >
                {icon}
              </div>
              <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
              >
                {label}
              </span>
            </div>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: 26,
                color: "var(--color-text-primary)",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
