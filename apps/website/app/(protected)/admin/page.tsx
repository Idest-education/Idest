import { requireAdmin } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, FileText, Video } from "lucide-react";

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
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of system statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.classes}</div>
            <p className="text-xs text-muted-foreground">Active classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sessions}</div>
            <p className="text-xs text-muted-foreground">Learning sessions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

