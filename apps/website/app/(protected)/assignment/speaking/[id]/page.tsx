"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSpeakingAssignment, submitSpeaking } from "@/services/assignment.service";
import { createClient } from "@/lib/supabase/client";
import { SpeakingAssignmentDetail } from "@/types/assignment";
import SidebarSpeaking from "@/components/assignment/SidebarSpeaking";
import LoadingScreen from "@/components/loading-screen";
import ProcessingScreen from "@/components/processing-screen";
import { Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import Image from "next/image";
import speakingCat from "@/assets/assignment-speaking.png";

interface Props {
    params: Promise<{ id: string }>;
}

type RecorderTarget = "part1" | "part2" | "part3";

export default function SpeakingAssignmentPage(props: Props) {
    const { id } = use(props.params);
    const router = useRouter();

    const [assignment, setAssignment] = useState<SpeakingAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [activePart, setActivePart] = useState<1 | 2>(1);

    const [audio1, setAudio1] = useState<File | null>(null);
    const [audio2, setAudio2] = useState<File | null>(null);
    const [audio3, setAudio3] = useState<File | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTarget, setRecordingTarget] = useState<RecorderTarget | null>(null);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    const [submitting, setSubmitting] = useState(false);

    const canRecord = useMemo(() => {
        return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSpeakingAssignment(id);
                setAssignment(data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    async function startRecording(target: RecorderTarget) {
        setRecordingError(null);
        if (!canRecord) {
            setRecordingError("Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp. Vui lòng tải lên file audio.");
            return;
        }
        if (isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Prefer opus/webm if supported
            const preferred = "audio/webm;codecs=opus";
            const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : undefined;

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                const ext = (recorder.mimeType || "").includes("ogg") ? "ogg" : "webm";
                const filename = `${target}.${ext}`;
                const file = new File([blob], filename, { type: blob.type });

                if (target === "part1") setAudio1(file);
                if (target === "part2") setAudio2(file);
                if (target === "part3") setAudio3(file);

                // Cleanup stream
                mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
                mediaStreamRef.current = null;
                mediaRecorderRef.current = null;
                chunksRef.current = [];
                setIsRecording(false);
                setRecordingTarget(null);
            };

            setIsRecording(true);
            setRecordingTarget(target);
            recorder.start();
        } catch (e) {
            console.error(e);
            setRecordingError("Không thể bắt đầu ghi âm. Vui lòng cho phép quyền micro hoặc tải lên file audio.");
            setIsRecording(false);
            setRecordingTarget(null);
        }
    }

    function stopRecording() {
        try {
            mediaRecorderRef.current?.stop();
        } catch (e) {
            console.error(e);
            // Ensure cleanup anyway
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
            mediaRecorderRef.current = null;
            chunksRef.current = [];
            setIsRecording(false);
            setRecordingTarget(null);
        }
    }

    function previewUrl(file: File | null) {
        if (!file) return null;
        return URL.createObjectURL(file);
    }

    async function handleSubmit() {
        if (!assignment || !audio1 || !audio2 || !audio3) {
            toast.error("Vui lòng ghi âm hoặc tải lên đầy đủ 3 bản ghi âm (phần 1, 2, 3).");
            return;
        }

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id ?? localStorage.getItem("user_id");

        if (!userId) {
            toast.error("Bạn chưa đăng nhập. Đăng nhập lại nha!");
            return;
        }

        setSubmitting(true);

        try {
            const res = await submitSpeaking(
                {
                    assignment_id: assignment.id,
                    user_id: userId,
                },
                {
                    audioOne: audio1,
                    audioTwo: audio2,
                    audioThree: audio3,
                }
            );

            const submissionId = res?.data?._id ?? res?.data?.id ?? res?._id ?? res?.id;

            if (submissionId) {
                router.push(`/assignment/speaking/${id}/result/${submissionId}`);
            } else {
                // fallback if id not in response
                try { sessionStorage.setItem("assignment_grading_queued", "1"); } catch {}
                router.push("/assignment/submissions");
            }
        } catch (err) {
            console.error("Failed to submit speaking:", err);
            toast.error("Nộp bài thất bại — thử lại nha!");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return <LoadingScreen />;
    }

    if (submitting) {
        return <ProcessingScreen skill="speaking" />;
    }

    if (!assignment) return <p className="p-6">Không tìm thấy</p>;

    const part1 = assignment.parts.find(p => p.part_number === 1);
    const part2 = assignment.parts.find(p => p.part_number === 2);
    const part3 = assignment.parts.find(p => p.part_number === 3);

    return (
        <div
            className="flex w-full h-[calc(100vh-44px)] overflow-hidden"
            style={{ backgroundColor: "#fafaf9" }}
        >
                    {/* LEFT CONTENT */}
                    <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--color-border-subtle)" }}>

                        {/* Cat tip strip */}
                        <div
                            className="flex items-center gap-2.5 px-5 py-2.5 flex-shrink-0"
                            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                        >
                            <div className="animate-float">
                                <Image src={speakingCat} alt="" width={22} height={22} className="object-contain" />
                            </div>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>
                                Nói rõ và tự nhiên — AI nghe được hết đâu!
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                        <div className="flex gap-3 mb-4">
                            <button
                                className={`px-4 py-2 rounded-full border transition-all ${activePart === 1
                                    ? "text-white border-transparent"
                                    : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                                    }`}
                                style={activePart === 1 ? { backgroundColor: "#FF6B35" } : {}}
                                onClick={() => setActivePart(1)}
                            >
                                Phần 1
                            </button>

                            <button
                                className={`px-4 py-2 rounded-full border transition-all ${activePart === 2
                                    ? "text-white border-transparent"
                                    : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                                    }`}
                                style={activePart === 2 ? { backgroundColor: "#FF6B35" } : {}}
                                onClick={() => setActivePart(2)}
                            >
                                Phần 2 + 3
                            </button>
                        </div>

                        <h1 className="text-2xl font-semibold mb-4">{assignment.title}</h1>

                        {activePart === 1 && part1 && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold" style={{ color: "#c43d0f" }}>Phần 1: Trò chuyện chung (1-2 phút)</h2>
                                <div className="p-4 bg-white/50 rounded-lg border border-slate-200 whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    <ReactMarkdown>{part1.question}</ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {activePart === 2 && (
                            <div className="space-y-6">
                                {part2 && (
                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold" style={{ color: "#9a2d08" }}>Phần 2: Bài nói dài (1-2 phút)</h2>
                                        <div className="p-6 bg-white border-2 rounded-xl shadow-sm whitespace-pre-wrap text-gray-800 leading-relaxed" style={{ borderColor: "#ffd0b5" }}>
                                            <ReactMarkdown>{part2.question}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {part3 && (
                                    <div className="space-y-4">
                                        <h2 className="text-lg font-semibold" style={{ color: "#7a2005" }}>Phần 3: Thảo luận (4-5 phút)</h2>
                                        <div className="p-6 bg-white border-2 rounded-xl shadow-sm whitespace-pre-wrap text-gray-800 leading-relaxed" style={{ borderColor: "#ffb088" }}>
                                            <ReactMarkdown>{part3.question}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>{/* end left scrollable */}
                    </div>{/* end left panel */}

                    {/* RIGHT – UPLOAD RECORDINGS */}
                    <div className="w-[45%] flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--color-border-subtle)" }}>
                        <h2 className="text-xl font-semibold p-4">Ghi âm hoặc tải lên bản ghi âm nói của bạn</h2>

                        {recordingError && (
                            <div className="mx-6 mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                                {recordingError}
                            </div>
                        )}

                        <div className="flex-1 px-6 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-6">

                                {/* PART 1 ONLY */}
                                {activePart === 1 && (
                                    <div className="rounded-xl p-6 border-2 transition-all hover:shadow-lg" style={{ background: "linear-gradient(135deg, #fff4ed, #ffe8d6)", borderColor: "#ffd0b5" }}>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#FF6B35" }}>
                                                1
                                            </div>
                                            <label className="text-lg font-bold text-gray-800">Bản ghi âm phần 1</label>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                id="audio-part-1"
                                                onChange={(e) => setAudio1(e.target.files?.[0] || null)}
                                            />
                                            <label
                                                htmlFor="audio-part-1"
                                                className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed rounded-lg cursor-pointer transition-all group"
                                                style={{ borderColor: "#ffb088" }}
                                            >
                                                <svg className="w-8 h-8 group-hover:scale-110 transition-transform" style={{ color: "#FF6B35" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <div className="text-center">
                                                    <p className="font-semibold" style={{ color: "#FF6B35" }}>
                                                        {audio1 ? audio1.name : "Nhấp để tải lên tệp âm thanh"}
                                                    </p>
                                                    <p className="text-sm text-gray-500 mt-1">MP3, WAV hoặc các định dạng âm thanh khác</p>
                                                </div>
                                            </label>
                                        </div>

                                        {audio1 && (
                                            <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                    ✓
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-green-800">{audio1.name}</p>
                                                    <p className="text-xs text-green-600">{(audio1.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                                <button
                                                    onClick={() => setAudio1(null)}
                                                    className="text-red-500 hover:text-red-700 font-medium text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}

                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                disabled={isRecording && recordingTarget !== "part1"}
                                                onClick={() => (isRecording && recordingTarget === "part1" ? stopRecording() : startRecording("part1"))}
                                                className={`px-4 py-2 rounded-lg font-semibold border transition-all flex items-center gap-2 ${isRecording && recordingTarget !== "part1" ? "opacity-50 cursor-not-allowed" : ""}`}
                                                style={{
                                                    backgroundColor: isRecording && recordingTarget === "part1" ? "#dc2626" : "#FF6B35",
                                                    color: "#ffffff",
                                                    borderColor: "transparent",
                                                }}
                                            >
                                                <Mic className="w-4 h-4" />
                                                {isRecording && recordingTarget === "part1" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                            </button>
                                            {isRecording && recordingTarget === "part1" && (
                                                <div className="flex items-end gap-1 h-8">
                                                    {[4, 7, 5, 9, 6, 8, 4, 7, 5].map((h, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-1 rounded-full animate-breathe"
                                                            style={{
                                                                height: `${h * 3}px`,
                                                                backgroundColor: "#FF6B35",
                                                                animationDelay: `${i * 0.1}s`,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {audio1 && (
                                                <audio controls src={previewUrl(audio1) ?? undefined} className="w-full" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* PART 2 + PART 3 */}
                                {activePart === 2 && (
                                    <>
                                        <div className="rounded-xl p-6 border-2 transition-all hover:shadow-lg" style={{ background: "linear-gradient(135deg, #fff4ed, #ffe8d6)", borderColor: "#ffb088" }}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#e5531a" }}>
                                                    2
                                                </div>
                                                <label className="text-lg font-bold text-gray-800">Bản ghi âm phần 2</label>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="audio/*"
                                                    className="hidden"
                                                    id="audio-part-2"
                                                    onChange={(e) => setAudio2(e.target.files?.[0] || null)}
                                                />
                                                <label
                                                    htmlFor="audio-part-2"
                                                    className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed rounded-lg cursor-pointer transition-all group"
                                                    style={{ borderColor: "#ffb088" }}
                                                >
                                                    <svg className="w-8 h-8 group-hover:scale-110 transition-transform" style={{ color: "#e5531a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    <div className="text-center">
                                                        <p className="font-semibold" style={{ color: "#e5531a" }}>
                                                            {audio2 ? audio2.name : "Nhấp để tải lên tệp âm thanh"}
                                                        </p>
                                                        <p className="text-sm text-gray-500 mt-1">MP3, WAV hoặc các định dạng âm thanh khác</p>
                                                    </div>
                                                </label>
                                            </div>

                                            {audio2 && (
                                                <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                        ✓
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-green-800">{audio2.name}</p>
                                                        <p className="text-xs text-green-600">{(audio2.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setAudio2(null)}
                                                        className="text-red-500 hover:text-red-700 font-medium text-sm"
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    disabled={isRecording && recordingTarget !== "part2"}
                                                    onClick={() => (isRecording && recordingTarget === "part2" ? stopRecording() : startRecording("part2"))}
                                                    className={`px-4 py-2 rounded-lg font-semibold border transition-all flex items-center gap-2 ${isRecording && recordingTarget !== "part2" ? "opacity-50 cursor-not-allowed" : ""}`}
                                                    style={{
                                                        backgroundColor: isRecording && recordingTarget === "part2" ? "#dc2626" : "#FF6B35",
                                                        color: "#ffffff",
                                                        borderColor: "transparent",
                                                    }}
                                                >
                                                    <Mic className="w-4 h-4" />
                                                    {isRecording && recordingTarget === "part2" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                                </button>
                                                {isRecording && recordingTarget === "part2" && (
                                                    <div className="flex items-end gap-1 h-8">
                                                        {[4, 7, 5, 9, 6, 8, 4, 7, 5].map((h, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-1 rounded-full animate-breathe"
                                                                style={{
                                                                    height: `${h * 3}px`,
                                                                    backgroundColor: "#FF6B35",
                                                                    animationDelay: `${i * 0.1}s`,
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {audio2 && (
                                                    <audio controls src={previewUrl(audio2) ?? undefined} className="w-full" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-xl p-6 border-2 transition-all hover:shadow-lg" style={{ background: "linear-gradient(135deg, #fff4ed, #ffd0b5)", borderColor: "#ff8a55" }}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#c43d0f" }}>
                                                    3
                                                </div>
                                                <label className="text-lg font-bold text-gray-800">Bản ghi âm phần 3</label>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="audio/*"
                                                    className="hidden"
                                                    id="audio-part-3"
                                                    onChange={(e) => setAudio3(e.target.files?.[0] || null)}
                                                />
                                                <label
                                                    htmlFor="audio-part-3"
                                                    className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed rounded-lg cursor-pointer transition-all group"
                                                    style={{ borderColor: "#ff8a55" }}
                                                >
                                                    <svg className="w-8 h-8 group-hover:scale-110 transition-transform" style={{ color: "#c43d0f" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                    </svg>
                                                    <div className="text-center">
                                                        <p className="font-semibold" style={{ color: "#c43d0f" }}>
                                                            {audio3 ? audio3.name : "Nhấp để tải lên tệp âm thanh"}
                                                        </p>
                                                        <p className="text-sm text-gray-500 mt-1">MP3, WAV hoặc các định dạng âm thanh khác</p>
                                                    </div>
                                                </label>
                                            </div>

                                            {audio3 && (
                                                <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                                                        ✓
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-green-800">{audio3.name}</p>
                                                        <p className="text-xs text-green-600">{(audio3.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setAudio3(null)}
                                                        className="text-red-500 hover:text-red-700 font-medium text-sm"
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    disabled={isRecording && recordingTarget !== "part3"}
                                                    onClick={() => (isRecording && recordingTarget === "part3" ? stopRecording() : startRecording("part3"))}
                                                    className={`px-4 py-2 rounded-lg font-semibold border transition-all flex items-center gap-2 ${isRecording && recordingTarget !== "part3" ? "opacity-50 cursor-not-allowed" : ""}`}
                                                    style={{
                                                        backgroundColor: isRecording && recordingTarget === "part3" ? "#dc2626" : "#FF6B35",
                                                        color: "#ffffff",
                                                        borderColor: "transparent",
                                                    }}
                                                >
                                                    <Mic className="w-4 h-4" />
                                                    {isRecording && recordingTarget === "part3" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                                </button>
                                                {isRecording && recordingTarget === "part3" && (
                                                    <div className="flex items-end gap-1 h-8">
                                                        {[4, 7, 5, 9, 6, 8, 4, 7, 5].map((h, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-1 rounded-full animate-breathe"
                                                                style={{
                                                                    height: `${h * 3}px`,
                                                                    backgroundColor: "#FF6B35",
                                                                    animationDelay: `${i * 0.1}s`,
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                                {audio3 && (
                                                    <audio controls src={previewUrl(audio3) ?? undefined} className="w-full" />
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* BOTTOM NEXT BUTTON */}
                        <div
                            className="flex-shrink-0 px-6 py-4"
                            style={{ borderTop: "1px solid var(--color-border-subtle)" }}
                        >
                            {activePart < 2 && (
                                <button
                                    onClick={() => setActivePart(2)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                    style={{ backgroundColor: "#FF6B35", color: "#ffffff" }}
                                >
                                    <span>Tiếp theo</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>{/* end right upload panel */}

                    {/* SIDEBAR */}
                    <div className="flex-shrink-0">
                        <SidebarSpeaking
                            activePart={activePart}
                            setActivePart={setActivePart}
                            onSubmit={handleSubmit}
                            onExit={() => router.push("/assignment")}
                        />
                    </div>
        </div>
    );
}
