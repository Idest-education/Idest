"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/services/http";

function getAssignmentBaseUrl() {
  return "http://localhost:8008";
}

export default function SpeakingPracticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRandomTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await http.get(`${getAssignmentBaseUrl()}/speaking/assignments`, {
        params: { page: 1, limit: 100 },
      });
      const list: any[] = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
      if (!list.length) {
        setError("Không có đề thi nào.");
        return;
      }
      const pick = list[Math.floor(Math.random() * list.length)];
      const assignmentId = pick._id ?? pick.id;
      router.push(`/assignment/speaking/${assignmentId}`);
    } catch {
      setError("Không thể tải đề thi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
          🎙️
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Luyện nói IELTS</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Bắt đầu một bài thi Speaking ngẫu nhiên. Ghi âm 3 phần, nộp bài và nhận kết quả chi tiết ngay.
        </p>

        {/* Start button */}
        <button
          onClick={startRandomTest}
          disabled={loading}
          className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 text-base"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang tải đề thi…
            </>
          ) : (
            <>▶ &nbsp;Bắt đầu ngẫu nhiên</>
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 inline-block">
            {error}
          </p>
        )}

        <div className="mt-10 text-xs text-slate-400">Chọn ngẫu nhiên từ các đề thi · Kết quả sau ~1 phút</div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: "🎤", title: "3 phần thi", desc: "Ghi âm từng phần theo đề bài" },
            { icon: "🤖", title: "Chấm điểm tự động", desc: "FC · LR · GR · Pronunciation" },
            { icon: "📊", title: "Kết quả chi tiết", desc: "Lỗi phát âm từng câu + gợi ý" },
          ].map((card) => (
            <div key={card.title} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 text-left">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-xs font-bold text-slate-800 mb-1">{card.title}</div>
              <div className="text-xs text-slate-500">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
