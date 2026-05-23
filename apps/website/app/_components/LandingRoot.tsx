"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import readingCat from "@/assets/assignment-reading.png";
import listeningCat from "@/assets/assignment-listening.png";
import writingCat from "@/assets/assignment-writing.png";
import speakingCat from "@/assets/assignment-speaking.png";
import { Github, Linkedin, Mail } from "lucide-react";

const videoSrc = "/assets/cat-peeps.webm";

const SKILLS = [
  {
    key: "reading",
    name: "Đọc hiểu",
    badge: "Reading · AI Grading",
    desc: "Luyện đọc với đề chuẩn Cambridge, AI chấm điểm chi tiết từng câu.",
    image: readingCat,
  },
  {
    key: "listening",
    name: "Nghe",
    badge: "Listening · AI Scoring",
    desc: "Nghe audio chuẩn IELTS, câu hỏi đa dạng, phân tích điểm từng section.",
    image: listeningCat,
  },
  {
    key: "writing",
    name: "Viết",
    badge: "Writing · AI Feedback",
    desc: "Viết Task 1 & 2, nhận phản hồi chi tiết theo 4 tiêu chí rubric.",
    image: writingCat,
  },
  {
    key: "speaking",
    name: "Nói",
    badge: "Speaking · AI Coaching",
    desc: "Ghi âm bài nói, AI đánh giá phát âm, lưu loát, từ vựng và ngữ pháp.",
    image: speakingCat,
  },
];

const HOW_STEPS = [
  {
    number: "01",
    title: "Chọn bài tập",
    desc: "Duyệt kho đề IELTS chuẩn theo kỹ năng. Có đề từ Band 5.0 đến 9.0.",
    image: readingCat,
  },
  {
    number: "02",
    title: "Làm bài",
    desc: "Giao diện tập trung, không rối mắt. Timer thông minh nhắc trước khi hết giờ.",
    image: writingCat,
  },
  {
    number: "03",
    title: "Nhận kết quả",
    desc: "AI trả kết quả trong 30 giây. Điểm từng tiêu chí, lỗi bôi màu, gợi ý cải thiện.",
    image: speakingCat,
  },
];

const STATS = [
  { value: "4", label: "kỹ năng IELTS" },
  { value: "30s", label: "AI trả kết quả" },
  { value: "100+", label: "bài tập" },
  { value: "9.0", label: "mục tiêu band" },
];

export default function LandingRoot() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${h}:${m}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="overflow-x-hidden" style={{ fontFamily: "var(--font-body)" }}>

      {/* ── NAV ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14 transition-all duration-300"
        style={{
          backgroundColor: isScrolled ? "rgba(11,11,11,0.88)" : "transparent",
          backdropFilter: isScrolled ? "blur(16px)" : "none",
          borderBottom: isScrolled ? "1px solid rgba(255,107,53,0.15)" : "none",
        }}
      >
        <Image src={logo} alt="Idest" width={100} height={50} className="h-5 w-auto opacity-90" priority />
        <span
          className="text-white/80 text-lg font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {currentTime}
        </span>
        <Link
          href="/auth/login"
          className="px-5 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{
            backgroundColor: "#FF6B35",
            color: "#ffffff",
            fontFamily: "var(--font-body)",
          }}
        >
          Đăng nhập
        </Link>
      </header>

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex flex-col items-center overflow-hidden"
        style={{ backgroundColor: "#0b0b0b" }}
      >
        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 85%" }}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src={videoSrc} type="video/webm" />
        </video>

        {/* Orange glow from video area */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 900px 600px at 50% 80%, rgba(255,107,53,0.22), transparent 70%)",
          }}
        />

        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,53,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-start pt-32 sm:pt-40 px-6 text-center gap-6">
          {/* Tag badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              border: "1px solid rgba(255,107,53,0.3)",
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.1em",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#FF6B35" }}
            />
            AI chấm bài · Giáo viên thật · IELTS chuẩn
          </div>

          {/* Headline */}
          <h1
            className="max-w-4xl leading-none text-center"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(52px, 9vw, 96px)",
              lineHeight: 0.95,
            }}
          >
            <span style={{ color: "#FF6B35" }}>HỌC TIẾNG ANH</span>
            <br />
            <span style={{ color: "#ffffff" }}>CÙNG IDEST NHÉ?</span>
          </h1>

          {/* Subheadline */}
          <p
            className="max-w-md text-sm sm:text-base leading-relaxed"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Luyện đủ 4 kỹ năng IELTS. AI chấm bài trong 30 giây. Biết ngay mình đang ở đâu.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <Link
              href="/auth/sign-up"
              className="px-8 py-3.5 rounded-xl font-bold text-base transition-all hover:brightness-110 hover:-translate-y-0.5 shadow-lg"
              style={{
                backgroundColor: "#FF6B35",
                color: "#ffffff",
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                boxShadow: "0 8px 32px rgba(255,107,53,0.35)",
              }}
            >
              ĐI HỌC LUÔN!
            </Link>
            <Link
              href="/auth/login"
              className="text-sm font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Tao đã có tài khoản →
            </Link>
          </div>

          {/* Scroll hint */}
          <div
            className="mt-16 flex flex-col items-center gap-2 animate-bounce-soft"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ letterSpacing: "0.2em" }}
            >
              Cuộn xuống
            </span>
            <div
              className="w-px h-8"
              style={{ background: "linear-gradient(to bottom, rgba(255,107,53,0.5), transparent)" }}
            />
          </div>
        </div>
      </section>

      {/* ── STRIPE DIVIDER ── */}
      <div
        className="h-1.5 w-full"
        style={{
          background:
            "linear-gradient(90deg, #dc2626, #FF6B35, #fbbf24, #FF6B35, #dc2626)",
          backgroundSize: "200% 100%",
          animation: "stripe-flow 3s linear infinite",
        }}
      />

      {/* ── SKILLS ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "var(--color-surface-app)" }}>
        <div className="max-w-5xl mx-auto">
          <p
            className="text-center text-xs font-bold uppercase mb-3"
            style={{
              color: "var(--color-brand)",
              letterSpacing: "0.15em",
              fontFamily: "var(--font-body)",
            }}
          >
            4 kỹ năng · 1 nền tảng
          </p>
          <h2
            className="text-center mb-12"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 42px)",
              color: "var(--color-text-primary)",
            }}
          >
            Luyện hết, không sót kỹ năng nào
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SKILLS.map((skill) => (
              <div
                key={skill.key}
                className="group flex flex-col items-center p-6 rounded-2xl transition-all duration-300 cursor-default"
                style={{
                  backgroundColor: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                <div className="relative w-24 h-24 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <Image
                    src={skill.image}
                    alt={skill.name}
                    fill
                    className="object-contain"
                    sizes="96px"
                  />
                </div>

                <div
                  className="text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                  style={{
                    backgroundColor: "var(--color-surface-subtle)",
                    color: "var(--color-brand)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {skill.badge}
                </div>

                <h3
                  className="mb-2"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "22px",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {skill.name}
                </h3>

                <p
                  className="text-center text-sm leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {skill.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#1a0a00" }}>
        <div className="max-w-4xl mx-auto">
          <p
            className="text-center text-xs font-bold uppercase mb-3"
            style={{ color: "#FF6B35", letterSpacing: "0.15em" }}
          >
            Cách hoạt động
          </p>
          <h2
            className="text-center mb-14"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 4vw, 38px)",
              color: "#ffffff",
            }}
          >
            3 bước đơn giản
          </h2>

          <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
            {HOW_STEPS.map((step, i) => (
              <div key={step.number} className="flex-1 flex flex-col items-center text-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{
                    backgroundColor: "#FF6B35",
                    color: "#ffffff",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="relative w-20 h-20 animate-float" style={{ animationDelay: `${i * 0.4}s` }}>
                  <Image src={step.image} alt="" fill className="object-contain" sizes="80px" />
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    color: "#ffffff",
                  }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-16 px-6" style={{ backgroundColor: "var(--color-surface-app)" }}>
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(36px, 5vw, 56px)",
                  color: "#FF6B35",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </span>
              <span
                className="text-xs font-medium text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 px-6 flex flex-col items-center text-center relative overflow-hidden"
        style={{ backgroundColor: "#0b0b0b" }}
      >
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-full"
          style={{
            height: "300px",
            background: "radial-gradient(ellipse 700px 300px at 50% 100%, rgba(255,107,53,0.18), transparent)",
          }}
        />

        <div className="relative w-32 h-32 mb-6 animate-float">
          <Image src={listeningCat} alt="" fill className="object-contain" sizes="128px" />
        </div>

        <h2
          className="mb-4 max-w-lg"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 48px)",
            color: "#ffffff",
            lineHeight: 1.05,
          }}
        >
          Còn đợi gì nữa? Học luôn đi!
        </h2>

        <p className="mb-8 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Miễn phí đăng ký · Không cần thẻ tín dụng · Bắt đầu trong 60 giây
        </p>

        <Link
          href="/auth/sign-up"
          className="px-10 py-4 rounded-xl font-bold transition-all hover:brightness-110 hover:-translate-y-0.5"
          style={{
            backgroundColor: "#FF6B35",
            color: "#ffffff",
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            boxShadow: "0 8px 32px rgba(255,107,53,0.4)",
          }}
        >
          ĐĂNG KÝ MIỄN PHÍ
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-8 px-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{
          backgroundColor: "#050505",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <Image src={logo} alt="Idest" width={80} height={40} className="h-4 w-auto opacity-60" />

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          © 2026 Idest. Học tiếng Anh cùng AI.
        </p>

        <div className="flex items-center gap-4" style={{ color: "rgba(255,255,255,0.35)" }}>
          <a
            href="https://www.linkedin.com/in/chihenhuynh/"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="hover:text-white transition-colors"
          >
            <Linkedin className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/LuckiPhoenix"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
          <a
            href="mailto:huynhchihen2005@gmail.com"
            aria-label="Email"
            className="hover:text-white transition-colors"
          >
            <Mail className="w-4 h-4" />
          </a>
        </div>
      </footer>
    </main>
  );
}
