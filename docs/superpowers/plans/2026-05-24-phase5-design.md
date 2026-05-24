# Phase 5 Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the warm orange design system to class pages, session pages, the live meet room, profile/settings, and admin pages — eliminating all cool colors, gradient text, dark gradient overlays, and side-stripe borders.

**Architecture:** Pure CSS/style pass — no new components, no API changes, no new dependencies. Each task targets one file or one cohesive component group. All changes are self-contained and can be committed independently.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, CSS custom properties (`var(--color-*)` tokens from DESIGN.md), Oswald/Plus Jakarta Sans/JetBrains Mono fonts.

---

## Task 1: ClassCard — warm flood hover, ghost watermark

**Files:**
- Modify: `apps/website/components/class/class-card.tsx`

- [ ] **Step 1: Replace the dark-gradient overlay and cool-gray borders**

Replace entire file content:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ClassData } from "@/types/class";
import { Users, ArrowRight } from "lucide-react";

export default function ClassCard({ cls, index = 0 }: { cls: ClassData; index?: number }) {
  const router = useRouter();
  const num = String(index + 1).padStart(2, "0");

  return (
    <div
      className="group relative overflow-hidden cursor-pointer"
      style={{
        background: "var(--color-surface-card)",
        border: "1.5px solid var(--color-border-default)",
        borderRadius: 12,
        transition: "transform 200ms ease, box-shadow 200ms ease, background 200ms ease, border-color 200ms ease",
      }}
      onClick={() => router.push(`/classes/${cls.slug}`)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "linear-gradient(135deg, #FF6B35 0%, #c94010 100%)";
        el.style.borderColor = "#FF6B35";
        el.style.transform = "translateY(-4px)";
        el.style.boxShadow = "0 12px 32px #FF6B3544";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "var(--color-surface-card)";
        el.style.borderColor = "var(--color-border-default)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Ghost number watermark */}
      <span
        className="absolute top-2 right-3 select-none pointer-events-none group-hover:opacity-[0.12] transition-opacity duration-200"
        style={{
          fontFamily: "Oswald, sans-serif",
          fontSize: 80,
          fontWeight: 700,
          color: "var(--color-brand)",
          opacity: 0.07,
          lineHeight: 1,
        }}
        aria-hidden
      >
        {num}
      </span>

      <div className="relative p-6 flex flex-col h-full">
        {/* Skill pill */}
        <div className="mb-3">
          <span
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full group-hover:bg-white/25 group-hover:text-white transition-colors duration-200"
            style={{
              background: "var(--color-brand)",
              color: "#fff",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            Lớp học
          </span>
        </div>

        {/* Class name */}
        <h3
          className="mb-2 line-clamp-2 group-hover:text-white transition-colors duration-200"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-text-primary)",
          }}
        >
          {cls.name}
        </h3>

        {/* Description */}
        <p
          className="text-xs line-clamp-2 flex-1 mb-4 group-hover:text-white/80 transition-colors duration-200"
          style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          {cls.description}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4 group-hover:border-white/20 transition-colors duration-200"
          style={{ borderTop: "1px solid var(--color-border-default)" }}
        >
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/80 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <Users className="w-3.5 h-3.5" />
              {cls._count.members}
            </span>
            <span
              className="flex items-center gap-1 text-xs group-hover:text-white/80 transition-colors duration-200"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {cls._count.sessions}
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-medium group-hover:text-white transition-colors duration-200"
            style={{ color: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Xem chi tiết
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ClassesSection to pass index**

In `apps/website/components/class/class-section.tsx`, pass index to ClassCard:

```tsx
import ClassCard from "./class-card";
import { ClassData } from "@/types/class";

export default function ClassesSection({
  title,
  classes,
}: {
  title: string;
  classes: ClassData[];
}) {
  return (
    <section>
      {title && (
        <h2
          className="font-semibold mb-4"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontSize: 20,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls, index) => (
          <ClassCard key={cls.id} cls={cls} index={index} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd apps/website && pnpm tsc --noEmit 2>&1 | grep -E "(class-card|class-section)" | head -20
```

Expected: no output (no errors for these files).

- [ ] **Step 4: Commit**

```bash
git add apps/website/components/class/class-card.tsx apps/website/components/class/class-section.tsx
git commit -m "feat(design): ClassCard warm flood hover, ghost watermark, warm title"
```

---

## Task 2: Classes List Page — warm bg, stat strip, callout, section headers, empty state

**Files:**
- Modify: `apps/website/app/(protected)/classes/page.tsx`

- [ ] **Step 1: Apply warm redesign to classes/page.tsx**

Replace the entire return statement (lines 139–414). The data-fetching logic above line 139 stays unchanged.

```tsx
  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      <div className="px-6 py-10">
        {/* Header */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Eyebrow pill */}
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
                style={{
                  background: "var(--color-surface-subtle)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                Học tập cùng nhau, phát triển cùng nhau
              </div>

              {/* H1 — Oswald, no gradient */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontWeight: 700,
                    fontSize: 40,
                    color: "var(--color-text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Lớp học
                </h1>
                <div className="flex items-center gap-2">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                      style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </button>
                  )}
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </button>
                </div>
              </div>

              <p
                className="max-w-[52ch]"
                style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 14 }}
              >
                Quản lý lớp học và hành trình học tập của bạn. Tạo, tham gia và khám phá các lớp học mới.
              </p>

              {/* Stat strip — 3 varied cells */}
              <div className="grid grid-cols-3 gap-3">
                {/* Cell 1 — accent */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-surface-subtle)",
                    border: "1.5px solid var(--color-brand)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 28,
                      fontWeight: 700,
                      color: "var(--color-brand)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.created.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Đã tạo</p>
                </div>
                {/* Cell 2 — standard */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.teaching.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Giảng dạy</p>
                </div>
                {/* Cell 3 — compact */}
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {classes.enrolled.length}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Ghi danh</p>
                </div>
              </div>

              {/* Next class callout */}
              {nextClassEvent && (
                <div
                  className="flex items-center gap-3 py-3 px-4"
                  style={{
                    background: "var(--color-surface-subtle)",
                    borderLeft: "3px solid var(--color-brand)",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <span
                    className="flex-shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: "var(--color-brand)" }}
                  />
                  <div className="min-w-0">
                    <p
                      className="font-semibold truncate text-sm"
                      style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {nextClassEvent.className}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {new Date(nextClassEvent.start).toLocaleString("vi-VN", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — Calendar unchanged */}
            <div className="min-w-0">
              <ClassScheduleCalendar
                events={calendarEvents}
                onSaveCalendar={() => void handleSaveCalendar()}
                savingCalendar={savingCalendar}
              />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 animate-in fade-in slide-in-from-top-4">
          <div className="relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm lớp học theo tên hoặc mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-10 pr-10 py-2.5 text-sm outline-none"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-brand)";
                e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {searching ? "Đang tìm kiếm..." : searchResults.length > 0 ? `Tìm thấy ${searchResults.length} lớp học` : "Không tìm thấy lớp học nào"}
            </p>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            {searching ? (
              <div className="py-24 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--color-border-default)", borderTopColor: "transparent" }}
                  />
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Đang tìm kiếm...</p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <ClassesSection title="" classes={searchResults} />
            ) : (
              <div
                className="rounded-2xl p-12 text-center"
                style={{
                  border: "1.5px dashed var(--color-border-default)",
                  background: "var(--color-surface-subtle)",
                }}
              >
                <div className="max-w-md mx-auto space-y-4">
                  <Search className="w-10 h-10 mx-auto" style={{ color: "var(--color-text-muted)" }} />
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 22,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Không tìm thấy lớp học
                  </h3>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Không tìm thấy lớp học nào cho &quot;{searchQuery}&quot;
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    Xóa tìm kiếm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Classes Sections */}
        {!searchQuery.trim() && (
          hasClasses ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {classes.created.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đã tạo bởi bạn
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.created.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.created} />
                </div>
              )}

              {classes.teaching.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đang giảng dạy
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.teaching.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.teaching} />
                </div>
              )}

              {classes.enrolled.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Đã ghi danh
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: "var(--color-surface-subtle)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "Plus Jakarta Sans, sans-serif",
                      }}
                    >
                      {classes.enrolled.length}
                    </span>
                  </div>
                  <ClassesSection title="" classes={classes.enrolled} />
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-2xl p-12 text-center animate-in fade-in slide-in-from-bottom-4"
              style={{
                border: "1.5px dashed var(--color-border-default)",
                background: "var(--color-surface-subtle)",
              }}
            >
              <div className="max-w-md mx-auto space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "var(--color-surface-muted)" }}
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--color-brand)" }}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                </div>
                <h3
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Chưa có lớp học nào
                </h3>
                <p className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                  Bắt đầu bằng cách tạo hoặc tham gia một lớp học để bắt đầu hành trình học tập của bạn.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                  {(userRole === "TEACHER" || userRole === "ADMIN") && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      <PlusCircle className="w-4 h-4" />
                      Tạo lớp học
                    </button>
                  )}
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Users className="w-4 h-4" />
                    Tham gia lớp học
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        <AddClassModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />
        <JoinClassModal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            getClasses().then((data) =>
              setClasses(data?.data || { created: [], teaching: [], enrolled: [] })
            );
          }}
        />
      </div>
    </div>
  );
```

Also remove the unused `BookOpen` import from the import line at the top (it's no longer used after removing the old stat items). The import line should become:

```tsx
import { GraduationCap, Users, Search, X } from "lucide-react";
```

And remove the unused `Button` and `Input` component imports (replaced with native elements):

```tsx
// Remove these two lines:
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/website && pnpm tsc --noEmit 2>&1 | grep "classes/page" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(protected\)/classes/page.tsx
git commit -m "feat(design): classes list — warm bg, stat strip, next-class callout, warm empty state"
```

---

## Task 3: SessionCard — orange join button, Oswald topic, warm borders/badges

**Files:**
- Modify: `apps/website/components/session/session-card.tsx`

- [ ] **Step 1: Apply warm redesign**

Replace entire file:

```tsx
"use client";

import { SessionData } from "@/types/session";
import { Clock, User, Users, Video, Download } from "lucide-react";
import { useRouter } from "next/navigation";

interface SessionCardProps {
  session: SessionData;
  onEdit?: (session: SessionData) => void;
  onEnd?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  currentUserId?: string;
  showActions?: boolean;
  canExportAttendance?: boolean;
  onExportAttendance?: (session: SessionData) => void;
  isExportingAttendance?: boolean;
  allowReviewAction?: boolean;
}

export default function SessionCard({
  session,
  onEdit,
  onEnd,
  onDelete,
  currentUserId,
  showActions = true,
  canExportAttendance = false,
  onExportAttendance,
  isExportingAttendance = false,
  allowReviewAction = false,
}: SessionCardProps) {
  const router = useRouter();

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isHost = currentUserId === session.host_id;
  const isActive = session.end_time === null;
  const isPast = session.end_time !== null && new Date(session.end_time) < new Date();

  const borderColor = isActive ? "var(--color-correct)" : "var(--color-border-default)";
  const bgColor = isActive ? "#f0fdf4" : "var(--color-surface-card)";

  return (
    <div
      className="rounded-xl p-4"
      style={{
        border: `1.5px solid ${borderColor}`,
        background: bgColor,
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
    >
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3
              style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: "var(--color-text-primary)",
              }}
            >
              {session.metadata?.topic || "Buổi học chưa có tên"}
            </h3>
            {isActive && (
              <span
                className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                style={{ background: "var(--color-correct)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Đang diễn ra
              </span>
            )}
            {isPast && (
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  background: "var(--color-surface-subtle)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Đã kết thúc
              </span>
            )}
          </div>

          <p className="text-xs mb-3" style={{ color: "var(--color-brand)", fontWeight: 600 }}>
            {session.class.name}
          </p>

          <div className="space-y-1">
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p>
                  {formatDateTime(session.start_time)}
                  {session.end_time && ` — ${formatTime(session.end_time)}`}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                  ({userTimezone})
                </p>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <User className="w-3.5 h-3.5" />
              Người chủ trì:{" "}
              <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                {session.host.full_name}
              </span>
            </p>
            {(session.attendance_summary?.total_attendees !== undefined ||
              session.metadata?.attendees_count !== undefined) && (
              <p className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <Users className="w-3.5 h-3.5" />
                Người tham gia:{" "}
                <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                  {session.attendance_summary?.total_attendees ?? session.metadata?.attendees_count}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isActive && (
            <button
              onClick={() => router.push(`/sessions/${session.id}/meet`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#FF6B35", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              <Video className="w-4 h-4" />
              Tham gia buổi học
            </button>
          )}

          {canExportAttendance && isPast && onExportAttendance && (
            <button
              onClick={() => onExportAttendance(session)}
              disabled={isExportingAttendance}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingAttendance ? "Đang tải..." : "See attendance"}
            </button>
          )}

          {allowReviewAction && isPast && (
            <button
              onClick={() => router.push(`/sessions/${session.id}/review`)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Xem lại buổi học
            </button>
          )}

          {showActions && isHost && (
            <div className="flex flex-row md:flex-col gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(session)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Chỉnh sửa
                </button>
              )}
              {isActive && onEnd && (
                <button
                  onClick={() => onEnd(session.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Kết thúc
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(session.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-error)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Xóa
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/website && pnpm tsc --noEmit 2>&1 | grep "session-card" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/website/components/session/session-card.tsx
git commit -m "feat(design): SessionCard — orange join button, Oswald topic, warm borders/badges"
```

---

## Task 4: Sessions List Page — warm bg, Oswald heading, pill filter tabs

**Files:**
- Modify: `apps/website/app/(protected)/sessions/page.tsx`

- [ ] **Step 1: Apply warm redesign**

Replace entire return statement (lines 86–137):

```tsx
  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      <div className="px-6 py-6 md:py-8 space-y-6">
        <div style={{ borderBottom: "1.5px solid var(--color-border-default)" }} className="pb-6">
          <h1
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: 32,
              color: "var(--color-text-primary)",
            }}
          >
            Buổi học của tôi
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Xem và quản lý các buổi học sắp tới và đã qua của bạn.
          </p>
        </div>

        {/* Warm pill filter tabs */}
        <div
          className="inline-flex rounded-full p-1 gap-1"
          style={{ background: "var(--color-surface-muted)" }}
        >
          {(["upcoming", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-150"
              style={
                filter === f
                  ? {
                      background: "var(--color-brand)",
                      color: "#fff",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }
                  : {
                      background: "transparent",
                      color: "var(--color-text-muted)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }
              }
            >
              {f === "upcoming" ? "Sắp tới" : "Đã qua"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--color-border-default)", borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--color-error)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            {error}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            Không tìm thấy buổi học {filter === "upcoming" ? "sắp tới" : "đã qua"}.
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                currentUserId={currentUserId}
                allowReviewAction={filter === "past"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
```

Also remove `import { Loader2 } from "lucide-react"` and `import { Button } from "@/components/ui/button"` (no longer used).

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/sessions/page.tsx
git commit -m "feat(design): sessions list — warm bg, Oswald heading, pill filter tabs"
```

---

## Task 5: Session Review Page — warm header band, info block, warm attendance sidebar

**Files:**
- Modify: `apps/website/app/(protected)/sessions/[sessionId]/review/page.tsx`

- [ ] **Step 1: Replace the return statement (lines 218–371)**

```tsx
  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      {/* Warm header band */}
      <div
        className="px-6 py-6"
        style={{
          background: "linear-gradient(160deg, #fff4ed 0%, #ffe8d6 100%)",
          borderBottom: "1.5px solid var(--color-border-default)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              style={{
                fontFamily: "Oswald, sans-serif",
                fontWeight: 700,
                fontSize: 28,
                color: "var(--color-text-primary)",
              }}
            >
              {title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {session ? formatDateTime(session.start_time) : "Xem lại buổi học"}
            </p>
          </div>
          <button
            onClick={() => router.push("/sessions")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <div
            className="rounded-xl p-10 text-center text-sm"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-muted)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
          >
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {error && (
              <div
                className="rounded-xl p-4 text-sm"
                style={{
                  background: "#fff5f5",
                  border: "1.5px solid #fecaca",
                  color: "var(--color-error)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left: video + info */}
              <div className="lg:col-span-2 space-y-4">
                {/* Video panel */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "#111", border: "1.5px solid var(--color-border-default)" }}
                >
                  {playbackUrl ? (
                    <video
                      controls
                      src={playbackUrl}
                      className="w-full max-h-[540px]"
                      style={{ background: "#111" }}
                    >
                      Trình duyệt của bạn không hỗ trợ video.
                    </video>
                  ) : (
                    <div className="p-10 text-center text-sm" style={{ color: "rgba(255,250,245,0.4)" }}>
                      Chưa có bản ghi cho buổi học này.
                    </div>
                  )}
                </div>

                {/* Download actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDownloadRecording}
                    disabled={!playbackUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                  >
                    <Download className="w-4 h-4" />
                    Tải video
                  </button>
                  <button
                    onClick={handleDownloadParticipation}
                    disabled={!session}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                    style={{
                      background: "var(--color-surface-card)",
                      border: "1.5px solid var(--color-border-default)",
                      color: "var(--color-text-primary)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Tải điểm danh
                  </button>
                </div>

                {/* Info block — label/value list, not a Card */}
                <div
                  className="rounded-xl p-5 space-y-3"
                  style={{
                    background: "var(--color-surface-subtle)",
                    border: "1.5px solid var(--color-border-default)",
                  }}
                >
                  {[
                    { label: "Chủ đề", value: title },
                    { label: "Lớp học", value: session?.class?.name ?? "N/A" },
                    { label: "Thời lượng", value: lengthText },
                    {
                      label: "Thời gian",
                      value: session
                        ? `${formatDateTime(session.start_time)}${session.end_time ? ` — ${formatDateTime(session.end_time)}` : ""}`
                        : "N/A",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-4 items-baseline">
                      <span
                        className="w-28 flex-shrink-0 text-xs uppercase tracking-widest"
                        style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: attendance sidebar */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                }}
              >
                {/* Sidebar header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    background: "var(--color-surface-subtle)",
                    borderBottom: "1.5px solid var(--color-border-default)",
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {showAllStudents ? "Tất cả học viên" : "Học viên tham gia"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadParticipation}
                      className="p-1.5 rounded-lg"
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1.5px solid var(--color-border-default)",
                        color: "var(--color-text-muted)",
                      }}
                      title="Tải điểm danh"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowAllStudents((prev) => !prev)}
                      className="p-1.5 rounded-lg"
                      style={{
                        background: "var(--color-surface-card)",
                        border: "1.5px solid var(--color-border-default)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {showAllStudents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Student list */}
                <div className="max-h-[640px] overflow-y-auto">
                  {visibleStudentItems.length ? (
                    <div className="divide-y" style={{ borderColor: "var(--color-border-default)" }}>
                      {visibleStudentItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                            >
                              {item.fullName}
                            </p>
                            {!item.isAbsent && (
                              <p
                                className="text-xs"
                                style={{ color: "var(--color-text-muted)", fontFamily: "JetBrains Mono, monospace" }}
                              >
                                {formatDuration(item.durationSeconds)}
                              </p>
                            )}
                          </div>
                          <span
                            className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={
                              item.isAbsent
                                ? {
                                    background: "var(--color-surface-muted)",
                                    color: "var(--color-text-muted)",
                                  }
                                : item.isAttended
                                  ? { background: "#dcfce7", color: "#166534" }
                                  : {
                                      background: "var(--color-surface-subtle)",
                                      color: "var(--color-text-secondary)",
                                    }
                            }
                          >
                            {item.isAbsent ? "Vắng" : item.isAttended ? "Đã tham gia" : "Chưa đủ điều kiện"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-center py-8 text-sm"
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                    >
                      {showAllStudents ? "Chưa có dữ liệu học viên." : "Chưa có dữ liệu người tham gia."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
```

Remove unused imports: `Badge`, `Card`, `CardContent`, `CardHeader`, `CardTitle` from shadcn. Keep `ArrowLeft`, `Calendar`, `ChevronDown`, `ChevronUp`, `Clock`, `Download`, `Users`, `Video`.

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/website && pnpm tsc --noEmit 2>&1 | grep "review/page" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(protected\)/sessions/\[sessionId\]/review/page.tsx
git commit -m "feat(design): session review — warm header band, info block, warm attendance sidebar"
```

---

## Task 6: Meet Page Chrome — dark warm header, tab bar

**Files:**
- Modify: `apps/website/app/(protected)/sessions/[sessionId]/meet/page.tsx`

- [ ] **Step 1: Apply dark warm palette to meet page chrome**

In `meet/page.tsx`, make the following targeted replacements:

**Outer container** (line 317):
```tsx
// Before:
<div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-background">
// After:
<div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden" style={{ background: "#0b0b0b" }}>
```

**Header bar** (lines 319–335):
```tsx
// Before:
<div className="flex-shrink-0 border-b border-border/40 bg-background px-4 py-2">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-sm font-semibold leading-tight">{headerTitle}</h1>
      {session && (
        <p className="text-xs text-muted-foreground">
          {format(new Date(session.start_time), "PPpp")}
        </p>
      )}
    </div>
// After:
<div
  className="flex-shrink-0 px-4 py-2.5"
  style={{ background: "#151515", borderBottom: "1px solid #2a2a2a" }}
>
  <div className="flex items-center justify-between">
    <div>
      <h1
        style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 600,
          fontSize: 15,
          color: "#fffaf5",
          lineHeight: 1.3,
        }}
      >
        {headerTitle}
      </h1>
      {session && (
        <p
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            color: "rgba(255,250,245,0.35)",
          }}
        >
          {format(new Date(session.start_time), "PPpp")}
        </p>
      )}
    </div>
```

**Status banner area** (line 338):
```tsx
// Before:
<div className="flex-shrink-0 px-4 py-2">
// After:
<div className="flex-shrink-0 px-4 py-1">
```

**Error banner inside status area** (lines 340–344):
```tsx
// Before:
<div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
// After:
<div className="mt-2 rounded-lg p-3 text-sm" style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", color: "#fca5a5" }}>
```

**Loading spinner** (line 353):
```tsx
// Before:
<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
// After:
<Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,250,245,0.35)" }} />
```

**TabsList** (line 370):
```tsx
// Before:
<TabsList className="grid w-full max-w-[400px] grid-cols-2">
// After:
<TabsList
  className="grid w-full max-w-[400px] grid-cols-2 p-1"
  style={{ background: "#151515", border: "1px solid #2a2a2a", borderRadius: 9999 }}
>
```

**TabsTrigger active style** — add inline style overrides after the `TabsList` change by wrapping each `TabsTrigger`:
```tsx
<TabsTrigger
  value="video"
  style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999 }}
  className="data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
>
  Cuộc gọi video
</TabsTrigger>
<TabsTrigger
  value="whiteboard"
  style={{ fontFamily: "Plus Jakarta Sans, sans-serif", borderRadius: 9999 }}
  className="data-[state=active]:bg-[#FF6B35] data-[state=active]:text-white text-[rgba(255,250,245,0.35)]"
>
  Bảng trắng
</TabsTrigger>
```

**Whiteboard border** (line 389):
```tsx
// Before:
className="rounded-md border border-border"
// After:
className="rounded-md" style={{ border: "1px solid #2a2a2a" }}
```

**"Waiting" fallback text** (line 408):
```tsx
// Before:
<div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
// After:
<div className="flex h-full items-center justify-center text-center text-sm" style={{ color: "rgba(255,250,245,0.35)" }}>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/sessions/\[sessionId\]/meet/page.tsx
git commit -m "feat(design): meet page chrome — dark warm header, tab bar, orange active tab"
```

---

## Task 7: Meet Controls, Chat Panel, Participants Panel, Status Banner

**Files:**
- Modify: `apps/website/components/meet/MeetControls.tsx`
- Modify: `apps/website/components/meet/MeetChatPanel.tsx`
- Modify: `apps/website/components/meet/MeetParticipantsPanel.tsx`
- Modify: `apps/website/components/meet/MeetStatusBanner.tsx`

- [ ] **Step 1: Warm MeetControls**

In `MeetControls.tsx`, replace the wrapper div (line 201):
```tsx
// Before:
<div className="flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-sm">
// After:
<div className="flex-shrink-0" style={{ background: "#151515", borderTop: "1px solid #2a2a2a" }}>
```

Replace the button group dividers (line 282):
```tsx
// Before:
<div className="mx-2 h-6 w-px bg-border hidden sm:block" />
// After (both instances):
<div className="mx-2 h-6 w-px hidden sm:block" style={{ background: "#2a2a2a" }} />
```

Replace Button variants for the control buttons — change `variant="secondary"` to inline styles for the on-state buttons, and keep `variant="destructive"` for off/leave:

Replace the mic button (lines 203–212):
```tsx
<button
  onClick={toggleAudio}
  disabled={disabled}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
  style={
    isAudioEnabled
      ? { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
      : { background: "var(--color-error)", color: "#fff", border: "none" }
  }
>
  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
  <span className="hidden sm:inline">{isAudioEnabled ? "Tắt tiếng" : "Bật tiếng"}</span>
</button>
```

Replace the video button (lines 214–227):
```tsx
<button
  onClick={toggleVideo}
  disabled={disabled}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
  style={
    isVideoEnabled
      ? { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
      : { background: "var(--color-error)", color: "#fff", border: "none" }
  }
>
  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
  <span className="hidden sm:inline">{isVideoEnabled ? "Dừng video" : "Bật video"}</span>
</button>
```

Replace screen share button trigger inner Button (lines 231–254):
```tsx
<button
  onClick={toggleScreenShare}
  disabled={disabled || (!canShareScreen && !isScreenSharing)}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium relative"
  style={{ background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }}
>
  {isScreenSharing ? <MonitorStop className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
  <span className="hidden sm:inline">{isScreenSharing ? "Dừng chia sẻ" : "Chia sẻ màn hình"}</span>
  {!canShareScreen && (
    <span className="absolute -top-1 -right-1 flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
    </span>
  )}
</button>
```

Replace recording button (lines 263–280):
```tsx
{MEET_RECORDING_ENABLED && canRecord && (
  <button
    onClick={toggleRecording}
    disabled={disabled}
    className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
    style={
      isRecording
        ? { background: "var(--color-error)", color: "#fff", border: "none" }
        : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
    }
  >
    {isRecording ? <StopCircle className="h-5 w-5 animate-pulse" /> : <Disc className="h-5 w-5" />}
    <span className="hidden sm:inline">{isRecording ? "Stop Rec" : "Record"}</span>
  </button>
)}
```

Replace participants button (lines 284–293):
```tsx
<button
  onClick={toggleParticipants}
  disabled={disabled}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
  style={
    showParticipants
      ? { background: "var(--color-brand)", color: "#fff", border: "none" }
      : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
  }
>
  <Users className="h-5 w-5" />
  <span className="hidden sm:inline">Participants</span>
</button>
```

Replace chat button (lines 295–304):
```tsx
<button
  onClick={toggleChat}
  disabled={disabled}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
  style={
    showChat
      ? { background: "var(--color-brand)", color: "#fff", border: "none" }
      : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
  }
>
  <MessageSquare className="h-5 w-5" />
  <span className="hidden sm:inline">Chat</span>
</button>
```

Replace leave button (line 307):
```tsx
<button
  onClick={leaveMeeting}
  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
  style={{ background: "var(--color-error)", color: "#fff", border: "none" }}
>
  <PhoneOff className="h-5 w-5" />
  <span className="hidden sm:inline">Leave</span>
</button>
```

Remove `import { Button } from "@/components/ui/button"` — no longer used.

- [ ] **Step 2: Warm MeetChatPanel**

Read the file first, then make targeted replacements:

```bash
head -50 apps/website/components/meet/MeetChatPanel.tsx
```

In `MeetChatPanel.tsx`, replace any `bg-card`, `border-border/40`, `bg-gradient-to-b from-gray-50/50 to-white`, `bg-white text-gray-900 border-gray-200`, `bg-gradient-to-br from-gray-300 to-gray-400` classes with warm equivalents.

The panel outer container should be:
```tsx
style={{ background: "#151515", border: "1px solid #2a2a2a" }}
```

Message list container:
```tsx
style={{ background: "#0b0b0b" }}
```

Other user's message bubble:
```tsx
style={{ background: "#2d1500", color: "#fffaf5", border: "1px solid #2a2a2a" }}
```

Avatar fallback:
```tsx
style={{ background: "#2d1500", color: "#fffaf5" }}
```

Input field:
```tsx
style={{ background: "rgba(255,250,245,0.07)", border: "1px solid #2a2a2a", color: "#fffaf5" }}
```

Send button:
```tsx
style={{ background: "var(--color-brand)" }}
```

- [ ] **Step 3: Warm MeetParticipantsPanel**

```bash
head -30 apps/website/components/meet/MeetParticipantsPanel.tsx
```

Replace `bg-card`, `border-border/40`, `bg-muted` with dark warm equivalents:

Panel container:
```tsx
style={{ background: "#151515", border: "1px solid #2a2a2a" }}
```

Avatar fallback background:
```tsx
style={{ background: "#2d1500", color: "#fffaf5" }}
```

- [ ] **Step 4: Warm MeetStatusBanner**

```bash
cat apps/website/components/meet/MeetStatusBanner.tsx
```

Replace `bg-muted/40 text-muted-foreground` joining state with:
```tsx
style={{ background: "rgba(26,10,0,0.6)", color: "rgba(255,250,245,0.7)" }}
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/components/meet/
git commit -m "feat(design): meet components — dark warm controls, chat, participants, status banner"
```

---

## Task 8: Profile Settings — warm card pattern, brand avatar ring, orange-focus inputs

**Files:**
- Modify: `apps/website/app/(protected)/settings/profile/page.tsx`

- [ ] **Step 1: Replace return statement (lines 132–256)**

```tsx
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6" style={{ background: "var(--color-surface-app)" }}>
      <h1
        style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--color-text-primary)",
        }}
      >
        Cài đặt hồ sơ
      </h1>

      {/* Profile card */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: 16,
        }}
      >
        {/* Card header */}
        <div
          className="px-6 py-4"
          style={{
            background: "var(--color-surface-subtle)",
            borderBottom: "1.5px solid var(--color-border-default)",
          }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--color-text-primary)",
            }}
          >
            Hồ sơ
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar section */}
          <div
            className="flex items-center gap-6 pb-6"
            style={{ borderBottom: "1.5px solid var(--color-border-default)" }}
          >
            <div
              className="h-[72px] w-[72px] rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{
                background: "var(--color-surface-subtle)",
                border: "2.5px solid var(--color-border-default)",
              }}
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.fullName || user.email} className="h-full w-full object-cover" />
              ) : (
                <span style={{ fontFamily: "Oswald, sans-serif", color: "var(--color-brand)" }}>
                  {((user.fullName && user.fullName.length > 0 ? user.fullName : user.email && user.email.length > 0 ? user.email : "U").charAt(0) || "U").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 18, color: "var(--color-text-primary)" }}>
                {user.fullName || user.email}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                {user.role} · {user.isActive ? "Hoạt động" : "Không hoạt động"}
              </p>
            </div>
            <div>
              <label
                htmlFor="avatar"
                className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  opacity: (!isEditingProfile) ? 0.5 : 1,
                  pointerEvents: (!isEditingProfile) ? "none" : "auto",
                }}
              >
                Đổi ảnh
              </label>
              <input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isUploading || !isEditingProfile}
                className="sr-only"
              />
            </div>
          </div>

          {/* Form fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { id: "name", label: "Họ và tên", value: name, disabled: !isEditingProfile, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value), placeholder: "Tên của bạn" },
              { id: "email", label: "Thư điện tử", value: user.email, disabled: true, onChange: undefined, placeholder: "" },
              { id: "role", label: "Vai trò", value: user.role, disabled: true, onChange: undefined, placeholder: "" },
              { id: "status", label: "Trạng thái", value: user.isActive ? "Hoạt động" : "Không hoạt động", disabled: true, onChange: undefined, placeholder: "" },
            ].map(({ id, label, value, disabled, onChange, placeholder }) => (
              <div key={id} className="space-y-1.5">
                <label
                  htmlFor={id}
                  className="block text-xs uppercase tracking-widest"
                  style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
                >
                  {label}
                </label>
                <input
                  id={id}
                  value={value}
                  disabled={disabled}
                  onChange={onChange}
                  placeholder={placeholder}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: disabled ? "var(--color-surface-muted)" : "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                  onFocus={(e) => {
                    if (!disabled) {
                      e.currentTarget.style.borderColor = "var(--color-brand)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {isEditingProfile ? (
              <>
                <button
                  type="button"
                  onClick={() => { setIsEditingProfile(false); if (user) setName(user.fullName || ""); }}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                >
                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                Chỉnh sửa hồ sơ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="overflow-hidden"
        style={{
          background: "#fff5f5",
          border: "1.5px solid #fecaca",
          borderRadius: 16,
        }}
      >
        <div
          className="px-6 py-4"
          style={{ background: "#fee2e2", borderBottom: "1.5px solid #fecaca" }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--color-error)",
            }}
          >
            Khu vực nguy hiểm
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Xóa tài khoản của bạn sẽ đăng xuất và vô hiệu hóa hồ sơ của bạn. Hành động này không thể hoàn tác.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-error)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            {isDeleting ? "Đang xóa..." : "Xóa tài khoản của tôi"}
          </button>
        </div>
      </div>
    </div>
  );
```

Remove unused imports: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Label`, `Input` from shadcn (all replaced with native elements).

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/settings/profile/page.tsx
git commit -m "feat(design): profile settings — warm card pattern, brand avatar, orange-focus inputs"
```

---

## Task 9: Password Settings — warm card pattern

**Files:**
- Modify: `apps/website/app/(protected)/settings/password/page.tsx`

- [ ] **Step 1: Replace return statement (lines 78–134)**

```tsx
  return (
    <div className="max-w-xl mx-auto py-10" style={{ background: "var(--color-surface-app)" }}>
      <h1
        className="mb-6"
        style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--color-text-primary)",
        }}
      >
        Đổi mật khẩu
      </h1>

      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: 16,
        }}
      >
        {/* Card header */}
        <div
          className="px-6 py-4"
          style={{
            background: "var(--color-surface-subtle)",
            borderBottom: "1.5px solid var(--color-border-default)",
          }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--color-text-primary)",
            }}
          >
            Mật khẩu
          </h2>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit}>
          {[
            { id: "currentPassword", label: "Mật khẩu hiện tại", value: currentPassword, setter: setCurrentPassword, autoComplete: "current-password", placeholder: "Nhập mật khẩu hiện tại" },
            { id: "newPassword", label: "Mật khẩu mới", value: newPassword, setter: setNewPassword, autoComplete: "new-password", placeholder: "Nhập mật khẩu mạnh" },
            { id: "confirmPassword", label: "Xác nhận mật khẩu mới", value: confirmPassword, setter: setConfirmPassword, autoComplete: "new-password", placeholder: "Nhập lại mật khẩu mới" },
          ].map(({ id, label, value, setter, autoComplete, placeholder }) => (
            <div key={id} className="space-y-1.5">
              <label
                htmlFor={id}
                className="block text-xs uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
              >
                {label}
              </label>
              <input
                id={id}
                type="password"
                autoComplete={autoComplete}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-brand)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
```

Remove unused imports: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Button`, `Label`, `Input`.

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/settings/password/page.tsx
git commit -m "feat(design): password settings — warm card pattern, orange-focus inputs"
```

---

## Task 10: AdminShell + AdminSidebar — warm-brown sidebar

**Files:**
- Modify: `apps/website/components/admin/AdminShell.tsx`
- Modify: `apps/website/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: AdminShell — warm main background**

Replace entire file:

```tsx
"use client";

import AdminSidebar from "./AdminSidebar";

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-surface-app)" }}>
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: AdminSidebar — warm-toned dark**

Replace entire file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Video,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/sessions", label: "Sessions", icon: Video },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 min-h-screen p-6 flex flex-col"
      style={{ background: "#1a0a00" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <h2
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: "#fffaf5",
            letterSpacing: "0.05em",
          }}
        >
          IDEST
        </h2>
        <p
          className="mt-0.5"
          style={{
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 11,
            color: "rgba(255,250,245,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          Admin Console
        </p>
      </div>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
              style={
                isActive
                  ? {
                      background: "var(--color-brand)",
                      color: "#ffffff",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,250,245,0.5)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                      fontSize: 14,
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#2d1500";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.8)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.5)";
                }
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <div style={{ borderTop: "1px solid rgba(255,250,245,0.1)" }} className="pt-4 mt-4">
        <Link
          href="/classes"
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
          style={{
            color: "rgba(255,250,245,0.5)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 14,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#2d1500";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.5)";
          }}
        >
          <ArrowLeft className="w-5 h-5 flex-shrink-0" />
          <span>Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/components/admin/AdminShell.tsx apps/website/components/admin/AdminSidebar.tsx
git commit -m "feat(design): admin shell/sidebar — warm-brown sidebar, IDEST Oswald logo"
```

---

## Task 11: Admin Dashboard — Oswald heading, warm stat strip

**Files:**
- Modify: `apps/website/app/(protected)/admin/page.tsx`

- [ ] **Step 1: Replace return statement (lines 44–87)**

```tsx
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
```

Remove unused imports: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `FileText`.

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/admin/page.tsx
git commit -m "feat(design): admin dashboard — Oswald heading, warm stat strip with icons"
```

---

## Task 12: Admin Users Page — warm table, warm filters, warm badges

**Files:**
- Modify: `apps/website/app/(protected)/admin/users/page.tsx`

- [ ] **Step 1: Replace return statement (lines 100–254)**

```tsx
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: 26,
              color: "var(--color-text-primary)",
            }}
          >
            Users Management
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Manage users, roles, and permissions
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-brand)";
              e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-default)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-default)";
          }}
        >
          <option value="all">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="TEACHER">Teacher</option>
          <option value="STUDENT">Student</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-brand)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border-default)";
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: 12,
        }}
      >
        {/* Table head bar */}
        <div
          className="px-5 py-3"
          style={{
            background: "var(--color-surface-muted)",
            borderBottom: "1.5px solid var(--color-border-default)",
          }}
        >
          <h3
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--color-text-primary)",
            }}
          >
            Users ({users?.total || 0})
          </h3>
        </div>

        {users && users.users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--color-border-default)" }}>
                  {["Name", "Email", "Role", "Status", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={`p-3 text-left text-xs uppercase tracking-widest ${h === "Actions" ? "text-right" : ""}`}
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em", fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.users.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: "1px solid var(--color-border-default)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface-subtle)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.fullName || "N/A"}
                    </td>
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.email}
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          user.role === "ADMIN"
                            ? { background: "#1a0a00", color: "#fffaf5" }
                            : { background: "var(--color-surface-subtle)", color: "var(--color-text-secondary)" }
                        }
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          user.isActive
                            ? { background: "#dcfce7", color: "#166534" }
                            : { background: "#fee2e2", color: "#7f1d1d" }
                        }
                      >
                        {user.isActive ? "Active" : "Banned"}
                      </span>
                    </td>
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.createdAt ? (() => {
                        try {
                          const date = new Date(user.createdAt);
                          return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
                        } catch { return "N/A"; }
                      })() : "N/A"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/users/${user.id}`}>
                          <button
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "var(--color-surface-muted)",
                              border: "1px solid var(--color-border-subtle)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        {user.isActive ? (
                          <button
                            onClick={() => handleBan(user.id)}
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              color: "var(--color-error)",
                            }}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnban(user.id)}
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "var(--color-surface-muted)",
                              border: "1px solid var(--color-border-subtle)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            No users found
          </div>
        )}

        {users && users.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1.5px solid var(--color-border-default)" }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Previous
            </button>
            <span className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Page {page} of {users.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(users.totalPages, p + 1))}
              disabled={page >= users.totalPages}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
```

Remove unused imports: `Button`, `Input`, `Badge`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`.

- [ ] **Step 2: Commit**

```bash
git add apps/website/app/\(protected\)/admin/users/page.tsx
git commit -m "feat(design): admin users — warm table, warm filters, warm role/status badges"
```

---

## Task 13: Admin Classes + Sessions — warm table color pass

**Files:**
- Modify: `apps/website/app/(protected)/admin/classes/page.tsx`
- Modify: `apps/website/app/(protected)/admin/sessions/page.tsx`

- [ ] **Step 1: Admin Classes — apply warm table pattern**

In `admin/classes/page.tsx`, make these targeted replacements:

**Page heading** (line 187–189):
```tsx
// Before:
<h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
<p className="text-gray-600 mt-2">View and manage all classes</p>
// After:
<h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color: "var(--color-text-primary)" }}>
  Classes Management
</h1>
<p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
  View and manage all classes
</p>
```

**Create button** (line 191–194):
```tsx
// Before:
<Button onClick={() => setShowCreateDialog(true)}>
  <Plus className="w-4 h-4 mr-2" />
  Create Class
</Button>
// After:
<button
  onClick={() => setShowCreateDialog(true)}
  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
  style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
>
  <Plus className="w-4 h-4" />
  Create Class
</button>
```

**Search card** — replace `<Card>...<CardContent>` wrapper with:
```tsx
<div
  className="rounded-xl p-4"
  style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)" }}
>
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
    <input
      placeholder="Search classes by name or description..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none"
      style={{
        background: "var(--color-surface-subtle)",
        border: "1.5px solid var(--color-border-default)",
        color: "var(--color-text-primary)",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; e.currentTarget.style.boxShadow = "none"; }}
    />
  </div>
</div>
```

**Table wrapper** — replace outer `<Card>` with:
```tsx
<div
  className="overflow-hidden"
  style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", borderRadius: 12 }}
>
```

**Table head bar** — replace `<CardHeader>...<CardTitle>` with:
```tsx
<div
  className="px-5 py-3"
  style={{ background: "var(--color-surface-muted)", borderBottom: "1.5px solid var(--color-border-default)" }}
>
  <h3 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>
    Classes ({classes?.pagination?.total || 0})
  </h3>
</div>
```

**Table `<th>` elements** — replace all:
```tsx
<th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>
  {header}
</th>
```

**Row hover** (line 237):
```tsx
// Before:
<tr key={classItem.id} className="border-b hover:bg-gray-50">
// After:
<tr
  key={classItem.id}
  style={{ borderBottom: "1px solid var(--color-border-default)" }}
  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface-subtle)"; }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
>
```

**Invite code chip** (line 260):
```tsx
// Before:
<code className="text-sm bg-gray-100 px-2 py-1 rounded">{classItem.invite_code}</code>
// After:
<code
  className="px-2 py-0.5 rounded text-xs"
  style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", fontFamily: "JetBrains Mono, monospace", color: "var(--color-text-primary)" }}
>
  {classItem.invite_code}
</code>
```

**Action buttons** (replace View/Edit/Delete `<Button>` elements):
```tsx
<Link href={`/admin/classes/${classItem.id}`}>
  <button className="p-1.5 rounded-lg" style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-secondary)" }}>
    <Eye className="w-4 h-4" />
  </button>
</Link>
<button onClick={() => handleEdit(classItem)} className="p-1.5 rounded-lg" style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-secondary)" }}>
  <Edit className="w-4 h-4" />
</button>
<button onClick={() => handleDelete(classItem.id)} className="p-1.5 rounded-lg" style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "var(--color-error)" }}>
  <Trash2 className="w-4 h-4" />
</button>
```

**Pagination buttons** — replace `<Button variant="outline">` with warm native buttons (same pattern as admin users Task 12).

**"No classes found"** text color:
```tsx
// Before:
<div className="text-center py-12 text-gray-500">No classes found</div>
// After:
<div className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>No classes found</div>
```

**Dialog headers** — in both Create and Edit dialogs, add warm input styles (same `onFocus`/`onBlur` pattern as admin users). The dialog components themselves (shadcn) don't need replacement; only add `style` props to the `<Input>` and `<Textarea>` elements inside them:
```tsx
// For each Input inside dialogs, add:
style={{
  background: "var(--color-surface-card)",
  border: "1.5px solid var(--color-border-default)",
  fontFamily: "Plus Jakarta Sans, sans-serif",
}}
// For each Button in DialogFooter, replace with warm native buttons:
// Cancel:
<button onClick={...} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Cancel</button>
// Submit:
<button onClick={...} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Create/Update</button>
```

- [ ] **Step 2: Admin Sessions — warm color pass**

In `admin/sessions/page.tsx` (the rest of the file beyond line 80), apply the same warm table pattern:

Read the rest of the file and replace:
- `text-gray-900` heading → Oswald style
- `text-gray-600` subtitle → `var(--color-text-muted)`
- `<Card>...<CardContent>` wrappers → warm `div` wrappers
- `hover:bg-gray-50` → warm `onMouseEnter/Leave`
- `text-green-100 text-green-800` active badge → `#dcfce7 / #166534`
- All `<Button variant="outline">` → warm native buttons
- `text-gray-500` empty state → `var(--color-text-muted)`

```bash
sed -n '80,200p' apps/website/app/\(protected\)/admin/sessions/page.tsx
```

Apply the same structural replacements used for admin users (Task 12) and classes (Task 13 Step 1).

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(protected\)/admin/classes/page.tsx apps/website/app/\(protected\)/admin/sessions/page.tsx
git commit -m "feat(design): admin classes + sessions — warm table, warm filters, warm badges"
```

---

## Self-Review Checklist

After all 13 tasks:

- [ ] ClassCard: no `from-gray-900 via-orange-900` strings remain in the file
- [ ] classes/page.tsx: no `bg-white`, no `bg-clip-text text-transparent`, no `animate-pulse` on the icon
- [ ] session-card.tsx: no `bg-blue-600`, no `text-green-100 text-green-800`
- [ ] sessions/page.tsx: no `bg-white`
- [ ] meet/page.tsx: no `bg-background`, no `border-border/40` in the page file
- [ ] MeetControls.tsx: no `border-border/40 bg-background/95`
- [ ] settings/profile/page.tsx: no `bg-gray-200` avatar
- [ ] AdminSidebar.tsx: no `bg-gray-900`, no `bg-gray-800`
- [ ] admin/page.tsx: no `text-gray-900` heading
- [ ] admin/users/page.tsx: no `hover:bg-gray-50`, no `bg-gray-100`

Run the scan:
```bash
grep -rn "bg-gray\|text-gray\|bg-white\|bg-blue\|from-gray\|bg-clip-text" \
  apps/website/components/class/class-card.tsx \
  apps/website/components/class/class-section.tsx \
  apps/website/components/session/session-card.tsx \
  apps/website/components/admin/AdminShell.tsx \
  apps/website/components/admin/AdminSidebar.tsx \
  apps/website/app/\(protected\)/classes/page.tsx \
  apps/website/app/\(protected\)/sessions/page.tsx \
  apps/website/app/\(protected\)/sessions/\[sessionId\]/meet/page.tsx \
  apps/website/app/\(protected\)/settings/profile/page.tsx \
  apps/website/app/\(protected\)/settings/password/page.tsx \
  apps/website/app/\(protected\)/admin/page.tsx \
  apps/website/app/\(protected\)/admin/users/page.tsx \
  2>&1 | grep -v "^Binary"
```

Expected: no output for these files (any hits indicate remaining anti-patterns to fix).
