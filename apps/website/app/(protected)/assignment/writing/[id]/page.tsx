"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getWritingAssignment, submitWriting } from "@/services/assignment.service";
import { WritingAssignmentDetail } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";
import ProcessingScreen from "@/components/processing-screen";
import WordCountBar from "@/components/assignment/word-count-bar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import writingCat from "@/assets/assignment-writing.png";

interface PageProps {
  params: Promise<{ id: string }>;
}

const MIN_WORDS = { task1: 150, task2: 250 };

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export default function WritingAssignmentPage(props: PageProps) {
  const { id } = use(props.params);
  const router = useRouter();

  const [assignment, setAssignment] = useState<WritingAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getWritingAssignment(id);
        setAssignment(data);
      } catch {
        toast.error("Không tải được bài tập. Thử lại nhé!");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleContentChange = useCallback((taskId: string, value: string) => {
    setContents((prev) => ({ ...prev, [taskId]: value }));
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      setSaving(true);
      setTimeout(() => {
        setLastSaved(new Date());
        setSaving(false);
      }, 600);
    }, 1500);
  }, []);

  async function handleSubmit() {
    if (!assignment) return;

    const allTasksDone = assignment.tasks.every(
      (task) => countWords(contents[task.id] ?? "") > 0,
    );
    if (!allTasksDone) {
      toast.error("Ơ khoan — có task chưa viết xong kia!");
      return;
    }

    const userId = localStorage.getItem("user_id");
    if (!userId) {
      toast.error("Bạn chưa đăng nhập. Đăng nhập lại nha!");
      return;
    }

    setSubmitting(true);

    try {
      const res = await submitWriting({
        assignment_id: assignment.id,
        user_id: userId,
        content_by_task_id: contents,
      });

      const submissionId = res?.data?._id;
      if (submissionId) {
        router.push(`/assignment/writing/${id}/result/${submissionId}`);
      } else {
        router.push("/assignment/submissions");
      }
    } catch {
      toast.error("Nộp bài thất bại — thử lại nha!");
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (submitting) return <ProcessingScreen skill="writing" />;
  if (!assignment?.tasks.length) return <p className="p-4">Không tìm thấy bài tập</p>;

  const activeTask = assignment.tasks[activeTaskIndex];
  const activeTaskKey = activeTaskIndex === 0 ? "task1" : "task2";
  const wordTarget = MIN_WORDS[activeTaskKey as keyof typeof MIN_WORDS] ?? 250;
  const wordCount = countWords(activeTask ? (contents[activeTask.id] ?? "") : "");

  return (
    <div
      className="flex w-full h-[calc(100vh-44px)] overflow-hidden"
      style={{ backgroundColor: "#fafaf9" }}
    >
      {/* LEFT — Task prompt */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ borderRight: "1px solid var(--color-border-subtle)" }}
      >
        {/* Task tab switcher */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          {assignment.tasks.map((task, idx) => {
            const isActive = activeTaskIndex === idx;
            return (
              <button
                key={task.id}
                onClick={() => setActiveTaskIndex(idx)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  backgroundColor: isActive ? "#FF6B35" : "var(--color-surface-subtle)",
                  color: isActive ? "#ffffff" : "var(--color-text-secondary)",
                  border: isActive ? "none" : "1px solid var(--color-border-default)",
                }}
              >
                Task {idx + 1}
              </button>
            );
          })}

          <div className="ml-auto opacity-35">
            <Image src={writingCat} alt="" width={18} height={18} className="object-contain" />
          </div>
        </div>

        {/* Prompt content */}
        {activeTask && (
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="prose max-w-none mb-4 text-sm leading-loose"
              style={{
                color: "var(--color-text-primary)",
                fontSize: "15px",
                lineHeight: "1.9",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeTask.prompt_md}
              </ReactMarkdown>
            </div>

            {activeTask.stimulus?.images?.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={img.url} alt={img.alt} className="rounded-xl mb-4 max-w-full" />
            ))}

            {activeTask.stimulus?.data_description_md && (
              <div
                className="p-4 rounded-xl text-sm"
                style={{
                  backgroundColor: "var(--color-surface-subtle)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {activeTask.stimulus.data_description_md}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT — Editor */}
      <div className="w-[46%] flex flex-col overflow-hidden">
        {/* Editor toolbar */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}
          >
            Bài viết
          </span>

          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: saving ? "#FF6B35" : lastSaved ? "#22c55e" : "var(--color-border-default)",
              }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {saving ? "Đang lưu..." : lastSaved ? "Đã lưu tự động" : "Chưa lưu"}
            </span>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">
          <textarea
            className="flex-1 w-full resize-none outline-none text-sm leading-loose"
            placeholder="Viết bài luận của bạn ở đây..."
            value={activeTask ? (contents[activeTask.id] ?? "") : ""}
            onChange={(e) => {
              if (activeTask) handleContentChange(activeTask.id, e.target.value);
            }}
            style={{
              backgroundColor: "transparent",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "15px",
              lineHeight: "1.9",
              border: "none",
            }}
          />

          <WordCountBar current={wordCount} target={wordTarget} />
        </div>

        {/* Bottom action bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          {activeTaskIndex < assignment.tasks.length - 1 ? (
            <button
              onClick={() => setActiveTaskIndex((i) => i + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#FF6B35", color: "#ffffff" }}
            >
              Task tiếp theo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "#FF6B35", color: "#ffffff" }}
            >
              Nộp bài
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}

          <button
            onClick={() => router.push("/assignment")}
            className="text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Thoát
          </button>
        </div>
      </div>
    </div>
  );
}
