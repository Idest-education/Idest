import { requireAdmin } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Users, GraduationCap, Video, BookOpen } from "lucide-react";
import { UserStackedLineChart, ClassCreationLineChart } from "@/components/admin/charts";
import type { UserMonthlyStat, ClassMonthlyStat } from "@/services/analytics.service";

async function getDashboardData() {
  const supabase = await createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://ie-backend.fly.dev";
  const assignmentApiUrl = process.env.NEXT_PUBLIC_ASSIGNMENT_API_URL || "";

  if (!token) {
    return { users: 0, classes: 0, sessions: 0, assignments: 0, userMonthly: [], classMonthly: [] };
  }

  try {
    const [usersRes, classesRes, sessionsRes, userMonthlyRes, classMonthlyRes, assignmentsRes] =
      await Promise.allSettled([
        fetch(`${apiUrl}/user/all?page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.ok ? r.json() : null),
        fetch(`${apiUrl}/class/all?page=1&pageSize=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.ok ? r.json() : null),
        fetch(`${apiUrl}/session?page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.ok ? r.json() : null),
        fetch(`${apiUrl}/user/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.ok ? r.json() : null),
        fetch(`${apiUrl}/class/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.ok ? r.json() : null),
        assignmentApiUrl
          ? fetch(`${assignmentApiUrl}/assignments`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.ok ? r.json() : null)
          : Promise.resolve(null),
      ]);

    const usersData     = usersRes.status     === "fulfilled" ? usersRes.value     : null;
    const classesData   = classesRes.status   === "fulfilled" ? classesRes.value   : null;
    const sessionsData  = sessionsRes.status  === "fulfilled" ? sessionsRes.value  : null;
    const userMonthData = userMonthlyRes.status === "fulfilled" ? userMonthlyRes.value : null;
    const classMonthData = classMonthlyRes.status === "fulfilled" ? classMonthlyRes.value : null;
    const assignmentsData = assignmentsRes.status === "fulfilled" ? assignmentsRes.value : null;

    let assignmentCount = 0;
    if (assignmentsData && typeof assignmentsData === "object" && !Array.isArray(assignmentsData)) {
      for (const key of Object.keys(assignmentsData)) {
        const arr = assignmentsData[key];
        if (Array.isArray(arr)) assignmentCount += arr.length;
      }
    }

    const userMonthly: UserMonthlyStat[] = Array.isArray(userMonthData?.data)
      ? userMonthData.data
      : Array.isArray(userMonthData)
      ? userMonthData
      : [];

    const classMonthly: ClassMonthlyStat[] = Array.isArray(classMonthData?.data)
      ? classMonthData.data
      : Array.isArray(classMonthData)
      ? classMonthData
      : [];

    return {
      users: usersData?.data?.total || usersData?.total || 0,
      classes: classesData?.data?.total || classesData?.total || 0,
      sessions: sessionsData?.data?.pagination?.total || sessionsData?.pagination?.total || 0,
      assignments: assignmentCount,
      userMonthly,
      classMonthly,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return { users: 0, classes: 0, sessions: 0, assignments: 0, userMonthly: [], classMonthly: [] };
  }
}

export default async function AdminDashboard() {
  await requireAdmin();
  const data = await getDashboardData();

  const statCards = [
    { label: "Tổng người dùng", value: data.users,       icon: <Users         className="w-5 h-5" style={{ color: "var(--color-brand)" }} /> },
    { label: "Tổng lớp học",    value: data.classes,     icon: <GraduationCap className="w-5 h-5" style={{ color: "#3b82f6" }} /> },
    { label: "Tổng buổi học",   value: data.sessions,    icon: <Video         className="w-5 h-5" style={{ color: "#8b5cf6" }} /> },
    { label: "Bài tập",         value: data.assignments, icon: <BookOpen      className="w-5 h-5" style={{ color: "#10b981" }} /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
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
          Tổng quan thống kê hệ thống
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon }) => (
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

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stacked line: users created per month by role */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
          }}
        >
          <h2
            className="mb-1 text-sm font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Người dùng tạo mới theo tháng
          </h2>
          <p className="mb-4 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            6 tháng gần nhất · phân theo vai trò
          </p>
          <UserStackedLineChart data={data.userMonthly} />
        </div>

        {/* Line: classes created per month */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
          }}
        >
          <h2
            className="mb-1 text-sm font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Lớp học tạo mới theo tháng
          </h2>
          <p className="mb-4 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            6 tháng gần nhất
          </p>
          <ClassCreationLineChart data={data.classMonthly} />
        </div>
      </div>
    </div>
  );
}
