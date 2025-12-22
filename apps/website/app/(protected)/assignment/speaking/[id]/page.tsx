"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSpeakingAssignment, submitSpeaking } from "@/services/assignment.service";
import { SpeakingAssignmentDetail } from "@/types/assignment";
import SidebarSpeaking from "@/components/assignment/SidebarSpeaking";
import LoadingScreen from "@/components/loading-screen";
import { Mic } from "lucide-react";

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
            const res = await getSpeakingAssignment(id);
            setAssignment(res.data);
            setLoading(false);
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
            alert("Vui lòng ghi âm hoặc tải lên đầy đủ 3 bản ghi âm (phần 1, 2, 3).");
            return;
        }

        const userId = localStorage.getItem("user_id");

        setSubmitting(true); // bật loading

        await submitSpeaking({
            assignment_id: assignment.id,
            user_id: userId!,
            audioOne: audio1,
            audioTwo: audio2,
            audioThree: audio3,
        });
        // Mark that we should show the "queued for grading" popup after redirect
        try {
            sessionStorage.setItem("assignment_grading_queued", "1");
        } catch {}
        router.push("/assignment/submissions");
    }

    if (submitting) {
        return <LoadingScreen />;
    }

    if (loading) {
        return <LoadingScreen />;
    }

    if (!assignment) return <p className="p-6">Không tìm thấy</p>;

    const part1 = assignment.parts.find(p => p.part_number === 1);
    const part2 = assignment.parts.find(p => p.part_number === 2);
    const part3 = assignment.parts.find(p => p.part_number === 3);

    return (
        <div className="flex w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* LEFT GROUP — Passage + Questions */}

            <div
                className="flex flex-1 mb-20 mt-10 ml-3"
            >

                {/* LEFT CONTENT */}
                <div className="flex-1 flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm p-4 rounded-l-2xl transition-all duration-300 hover:rounded-r-3x">
                    <div className="flex gap-3 mb-4">
                        <button
                            className={`px-4 py-2 rounded-full border ${activePart === 1 ? "bg-blue-600 text-white" : "bg-gray-200"
                                }`}
                            onClick={() => setActivePart(1)}
                        >
                            Phần 1
                        </button>

                        <button
                            className={`px-4 py-2 rounded-full border ${activePart === 2 ? "bg-blue-600 text-white" : "bg-gray-200"
                                }`}
                            onClick={() => setActivePart(2)}
                        >
                            Phần 2 + 3
                        </button>
                    </div>

                    <h1 className="text-2xl font-semibold mb-4">{assignment.title}</h1>

                    {activePart === 1 && part1 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3">Câu hỏi phần 1</h2>
                            {part1.questions.map((q) => (
                                <p key={q.id} className="mb-3 text-gray-800">
                                    • {q.prompt}
                                </p>
                            ))}
                        </div>
                    )}

                    {activePart === 2 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3">Phần 2</h2>
                            {part2?.questions.map((q) => (
                                <p key={q.id} className="mb-4 text-gray-800">
                                    • {q.prompt}
                                </p>
                            ))}

                            <h2 className="text-lg font-semibold mt-6 mb-3">Phần 3</h2>
                            {part3?.questions.map((q) => (
                                <p key={q.id} className="mb-4 text-gray-800">
                                    • {q.prompt}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* MIDDLE – UPLOAD RECORDINGS */}
                <div className="w-[45%] flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl transition-all duration-300 hover:rounded-r-3x">
                    <h2 className="text-xl font-semibold p-4">Ghi âm hoặc tải lên bản ghi âm nói của bạn</h2>

                    {recordingError && (
                        <div className="mx-6 mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                            {recordingError}
                        </div>
                    )}

                    <div className="flex-1 px-6 overflow-y-auto">
                        <div className="space-y-6">

                            {/* PART 1 ONLY */}
                            {activePart === 1 && (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-indigo-200 transition-all hover:shadow-lg">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
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
                                            className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                                        >
                                            <svg className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <div className="text-center">
                                                <p className="text-indigo-600 font-semibold group-hover:text-indigo-700">
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
                                            className={`px-4 py-2 rounded-lg font-semibold border transition-all ${isRecording && recordingTarget === "part1"
                                                ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                                                : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                                                } ${isRecording && recordingTarget !== "part1" ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <Mic className="w-4 h-4" />
                                                {isRecording && recordingTarget === "part1" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                            </span>
                                        </button>
                                        {audio1 && (
                                            <audio controls src={previewUrl(audio1) ?? undefined} className="w-full" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PART 2 + PART 3 */}
                            {activePart === 2 && (
                                <>
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200 transition-all hover:shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
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
                                                className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all group"
                                            >
                                                <svg className="w-8 h-8 text-purple-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <div className="text-center">
                                                    <p className="text-purple-600 font-semibold group-hover:text-purple-700">
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
                                                className={`px-4 py-2 rounded-lg font-semibold border transition-all ${isRecording && recordingTarget === "part2"
                                                    ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                                                    : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
                                                    } ${isRecording && recordingTarget !== "part2" ? "opacity-50 cursor-not-allowed" : ""}`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <Mic className="w-4 h-4" />
                                                    {isRecording && recordingTarget === "part2" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                                </span>
                                            </button>
                                            {audio2 && (
                                                <audio controls src={previewUrl(audio2) ?? undefined} className="w-full" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border-2 border-teal-200 transition-all hover:shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">
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
                                                className="flex items-center justify-center gap-3 w-full p-6 bg-white border-2 border-dashed border-teal-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-all group"
                                            >
                                                <svg className="w-8 h-8 text-teal-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <div className="text-center">
                                                    <p className="text-teal-600 font-semibold group-hover:text-teal-700">
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
                                                className={`px-4 py-2 rounded-lg font-semibold border transition-all ${isRecording && recordingTarget === "part3"
                                                    ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                                                    : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50"
                                                    } ${isRecording && recordingTarget !== "part3" ? "opacity-50 cursor-not-allowed" : ""}`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <Mic className="w-4 h-4" />
                                                    {isRecording && recordingTarget === "part3" ? "Dừng ghi âm" : "Ghi âm trực tiếp"}
                                                </span>
                                            </button>
                                            {audio3 && (
                                                <audio controls src={previewUrl(audio3) ?? undefined} className="w-full" />
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM NEXT BUTTON — giống reading */}
                    <div className="border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-4 mt-auto rounded-br-2xl transition-all duration-300 hover:rounded-r-3x">
                        {activePart < 2 && (
                            <button
                                onClick={() => setActivePart(2)}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 
                           hover:from-blue-700 hover:to-indigo-700 text-white font-medium 
                           rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                           transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <span>Tiếp theo</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT – Sidebar */}
            <div className="mmb-10 mt-10 ml-3 mr-3">
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