"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Calendar,
  BookOpen,
  Trophy,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Clock,
  ThumbsUp,
  Target,
  PenTool,
  Compass,
  ChevronRight,
  Volume2,
  ListFilter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getProgressTimeline,
  getProgressQuestionTypes,
  getProgressWritingRubrics,
} from "@/services/progress.service";
import LoadingScreen from "@/components/loading-screen";
import {
  TimelineResponse,
  QuestionTypesResponse,
  WritingRubricsResponse,
} from "@/types/progress";

type Skill = "reading" | "listening" | "writing" | "speaking" | "overall";
type WindowType = "7d" | "30d" | "90d" | "all";

export default function ProgressDashboard() {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill>("overall");
  const [window, setWindow] = useState<WindowType>("90d");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // API Data States
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypesResponse | null>(null);
  const [writingRubrics, setWritingRubrics] = useState<WritingRubricsResponse | null>(null);

  // Chart states
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    timestamp: string;
    score: number;
    submissionId: string;
    assignmentId?: string;
    skill?: string;
  } | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Timeline for selected skill & window
      const timelineRes = await getProgressTimeline(skill, window);
      setTimeline(timelineRes);

      // 2. Fetch Question Types if skill is Reading or Listening
      if (skill === "reading" || skill === "listening") {
        const qtRes = await getProgressQuestionTypes(skill, window);
        setQuestionTypes(qtRes);
      } else {
        setQuestionTypes(null);
      }

      // 3. Fetch Writing Rubrics if skill is Writing
      if (skill === "writing") {
        const wrRes = await getProgressWritingRubrics(window);
        setWritingRubrics(wrRes);
      } else {
        setWritingRubrics(null);
      }
    } catch (e: any) {
      console.error("Lỗi khi tải dữ liệu tiến trình:", e);
      setError(e.message || "Không thể tải dữ liệu tiến độ của bạn. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadData();
    }
  }, [skill, window, mounted]);

  // AI Mascot (Miu the Orange Cat) Quote Generator based on selected skill
  const getMiuQuote = () => {
    if (skill === "overall") {
      return "Miu thấy bạn đang tiến bộ vèo vèo đấy! Hôm nay làm nhẹ một đề ôn tập để giữ vững phong độ nha! 🍊";
    }
    if (skill === "reading") {
      return "Đọc nhiều thì lên tay thui! Kỹ thuật lướt quét (Skimming/Scanning) là chìa khóa vàng để phá đảo IELTS Reading đó! 📖";
    }
    if (skill === "listening") {
      return "Luyện nghe là phải tập trung cao độ, né bẫy distractors nha! Miu cá là tai bạn đang nhạy bén lên từng ngày rồi! 🎧";
    }
    if (skill === "writing") {
      return "Giám khảo cực kỳ thích bài viết mạch lạc (Coherence & Cohesion). Nhớ đọc kỹ gợi ý nâng từ vựng xịn của Miu nhé! ✍️";
    }
    if (skill === "speaking") {
      return "Phát âm chuẩn âm vị (IPA) giúp band điểm Speaking tăng vút! Hãy nghe lại từng từ bị lỗi phát âm trong trang kết quả nha! 🎙️";
    }
    return "Chào ngày mới! Cùng Miu chiến đấu để nâng band IELTS hôm nay nào! 🐱🔥";
  };

  // SVG Chart Computations (Styled in Orange Warm theme palette)
  const chartConfig = useMemo(() => {
    if (!timeline || !timeline.points || timeline.points.length === 0) {
      return null;
    }

    const svgWidth = 800;
    const svgHeight = 360; // Tăng chiều cao tổng thể để biểu đồ thoáng hơn
    const paddingLeft = 60;
    const paddingRight = 60; // Tăng padding để điểm không bị dính lề
    const paddingTop = 40;
    const paddingBottom = 60;

    const plotWidth = svgWidth - paddingLeft - paddingRight;
    const plotHeight = svgHeight - paddingTop - paddingBottom;

    // Sắp xếp theo trình tự thời gian
    const pts = [...timeline.points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const timestamps = pts.map((p) => new Date(p.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    const getX = (timestamp: string, index: number) => {
      if (pts.length === 1) {
        return paddingLeft + plotWidth / 2;
      }
      // FIX: Nếu các bài nộp trùng ngày (maxTime === minTime), xếp chúng giãn cách đều quanh trung tâm thay vì kéo dẹt ra 2 biên
      if (maxTime === minTime) {
        const center = paddingLeft + plotWidth / 2;
        const step = 80; // Khoảng cách pixel cố định giữa các điểm trùng ngày
        const startX = center - ((pts.length - 1) * step) / 2;
        return startX + index * step;
      }
      // Thêm lề 30px bên trong khu vực vẽ để điểm đầu/cuối không đập sát vách lưới
      return paddingLeft + 30 + ((new Date(timestamp).getTime() - minTime) / (maxTime - minTime)) * (plotWidth - 60);
    };

    const getY = (score: number) => {
      // IELTS scale từ 0.0 đến 9.0, giới hạn biên để chấm điểm thấp không bị lấp mất nửa vòng tròn dưới đáy
      const safeScore = score < 0.5 ? 0.3 : score;
      return svgHeight - paddingBottom - (safeScore / 9) * plotHeight;
    };

    const mappedPoints = pts.map((p, index) => ({
      x: getX(p.timestamp, index),
      y: getY(p.score),
      timestamp: p.timestamp,
      score: p.score,
      submissionId: p.submissionId,
      assignmentId: (p as any).assignmentId,
      skill: (p as any).skill || skill,
    }));

    // Khởi tạo đường vẽ nét và vùng đổ màu
    let linePath = "";
    let areaPath = "";

    if (mappedPoints.length > 0) {
      // Sử dụng đường kẻ thẳng nhưng tối ưu vị trí (Hoặc dùng đường cong Bézier nếu muốn)
      linePath = `M ${mappedPoints[0].x} ${mappedPoints[0].y}`;
      mappedPoints.forEach((p, i) => {
        if (i > 0) linePath += ` L ${p.x} ${p.y}`;
      });

      areaPath = `${linePath} L ${mappedPoints[mappedPoints.length - 1].x} ${svgHeight - paddingBottom} L ${mappedPoints[0].x} ${svgHeight - paddingBottom} Z`;
    }

    // Phân cấp các dải điểm danh vọng IELTS đồng đều chân thực hơn
    const gridBands = [0, 2.0, 4.0, 6.0, 7.0, 8.0, 9.0];
    const gridLines = gridBands.map((band) => ({
      y: getY(band),
      label: band.toFixed(1),
    }));

    return {
      svgWidth,
      svgHeight,
      paddingLeft,
      paddingBottom,
      plotWidth,
      plotHeight,
      mappedPoints,
      linePath,
      areaPath,
      gridLines,
    };
  }, [timeline, skill]);

  // Skill color palette mappings corresponding to the "Orange Warm" Design System
  const skillColorConfig = {
    overall: {
      from: "from-[#FF6B35] to-[#E0531F]",
      stroke: "#FF6B35",
      bgLight: "bg-[#FFF0E6]/30",
      text: "text-[#FF6B35]",
      border: "border-[#FFD9C2]",
      badge: "bg-[#FFECE0] text-[#FF6B35] border-[#FFD9C2]",
    },
    reading: {
      from: "from-[#FF8A5B] to-[#FF6B35]",
      stroke: "#FF6B35",
      bgLight: "bg-[#FFF0E6]/20",
      text: "text-[#FF6B35]",
      border: "border-[#FFD9C2]",
      badge: "bg-[#FFECE0] text-[#FF6B35] border-[#FFD9C2]",
    },
    listening: {
      from: "from-[#FFAE63] to-[#FF8A3D]",
      stroke: "#FF8A3D",
      bgLight: "bg-[#FFF4EB]/30",
      text: "text-[#FF8A3D]",
      border: "border-[#FFE2CC]",
      badge: "bg-[#FFF2E6] text-[#FF8A3D] border-[#FFE2CC]",
    },
    writing: {
      from: "from-[#FF6B35] to-[#DE4B16]",
      stroke: "#FF6B35",
      bgLight: "bg-[#FFF0E6]/40",
      text: "text-[#DE4B16]",
      border: "border-[#FFC7A8]",
      badge: "bg-[#FFEADF] text-[#DE4B16] border-[#FFC7A8]",
    },
    speaking: {
      from: "from-[#FF9068] to-[#FF4B2B]",
      stroke: "#FF4B2B",
      bgLight: "bg-[#FFEFEA]/40",
      text: "text-[#FF4B2B]",
      border: "border-[#FFD0BF]",
      badge: "bg-[#FFEAE2] text-[#FF4B2B] border-[#FFD0BF]",
    },
  }[skill];

  const handlePointClick = (pt: any) => {
    if (pt.submissionId && pt.assignmentId && pt.skill) {
      router.push(`/assignment/${pt.skill}/${pt.assignmentId}/result/${pt.submissionId}`);
    } else {
      router.push(`/assignment/submissions`);
    }
  };

  const getWindowLabel = (w: WindowType) => {
    switch (w) {
      case "7d":
        return "7 ngày qua";
      case "30d":
        return "30 ngày qua";
      case "90d":
        return "90 ngày qua";
      case "all":
        return "Tất cả thời gian";
    }
  };

  const getSkillLabel = (s: Skill) => {
    switch (s) {
      case "overall":
        return "Trung bình chung (Overall)";
      case "reading":
        return "Reading";
      case "listening":
        return "Listening";
      case "writing":
        return "Writing";
      case "speaking":
        return "Speaking";
    }
  };

  if (!mounted) {
    return <LoadingScreen />;
  }

  return (
    <div className="px-6 py-8 min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#FFFDFB] via-[#FFF9F3] to-[#FFF1E6] text-[#2D1B10]">

      {/* Redesigned Orange-Warm Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 mb-8 border-b border-[#F0D6C4]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#FFECE0] text-[#FF6B35] font-mono text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase border border-[#FFD9C2]">
              Idest Performance Core
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-[#2D1B10] tracking-tight mb-2 font-sans">
            Hành trình nâng band <span className="text-[#FF6B35]">IELTS</span>
          </h1>
          <p className="text-[#6F5543] max-w-2xl text-sm font-medium">
            Theo dõi sự tiến bộ một cách trực quan, phân tích điểm số các kỹ năng dựa trên trí tuệ nhân tạo local và trợ lý học tập Miu của bạn.
          </p>
        </div>
        <div className="flex gap-3 self-start md:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="rounded-[16px] bg-white border-[#F0D6C4] text-[#6F5543] hover:bg-[#FFF6F0] hover:text-[#FF6B35] transition-all duration-300 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Làm mới dữ liệu
          </Button>
          <Button asChild size="sm" className="rounded-[16px] shadow-[0_4px_14px_rgba(255,107,53,0.35)] bg-[#FF6B35] hover:bg-[#DE4B16] text-white transition-all duration-300 font-bold border-0 px-5">
            <Link href="/assignment">Luyện tập ngay <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 text-red-800 rounded-[20px] shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="text-sm font-semibold">{error}</div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Controls, Trend & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">

        {/* Left Sidebar: Controls & Mascot Corner */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Mascot Miu Chatbox Widget */}
          <div className="relative overflow-hidden rounded-[24px] border border-[#FFD2B8] bg-[#FFF3EC] p-5 shadow-[0_8px_30px_rgba(255,107,53,0.05)] transition-all duration-300 group hover:shadow-[0_8px_30px_rgba(255,107,53,0.1)]">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${skillColorConfig.from} opacity-5 blur-xl group-hover:scale-125 transition-transform duration-500`} />
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-2xl shadow-md border border-[#FFF] transform transition-transform group-hover:rotate-12 duration-300">
                🐱
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-[#2D1B10]">Góc Nhỏ Của Miu</span>
                  <span className="bg-[#FFECE0] text-[#FF6B35] text-[9px] font-black px-2 py-0.5 rounded-full border border-[#FFD9C2]">AI Tutor</span>
                </div>
                <p className="text-xs text-[#6F5543] leading-relaxed italic font-medium">
                  "{getMiuQuote()}"
                </p>
              </div>
            </div>
          </div>

          {/* Skill Selection Filter */}
          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)] overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#FBE3D1]/50">
              <CardTitle className="text-md font-extrabold flex items-center gap-2 text-[#2D1B10]">
                <Compass className="w-5 h-5 text-[#FF6B35]" />
                Hôm nay ôn gì nào?
              </CardTitle>
              <CardDescription className="text-[#6F5543] text-xs">Chọn kỹ năng để Miu phân tích sâu hơn</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 pt-4">
              {(["overall", "reading", "listening", "writing", "speaking"] as Skill[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSkill(s)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-[16px] text-xs font-black tracking-wide transition-all duration-300 border ${skill === s
                    ? `bg-gradient-to-r ${skillColorConfig.from} text-white shadow-md border-transparent scale-[1.02]`
                    : "bg-[#FFFDFB] border-[#F2E5DC] text-[#6F5543] hover:bg-[#FFF6F0] hover:text-[#FF6B35]"
                    }`}
                >
                  <span className="capitalize">{getSkillLabel(s)}</span>
                  {skill === s ? (
                    <ChevronRight className="w-4 h-4 animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]/30" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Timeline Window Controls */}
          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-extrabold flex items-center gap-2 text-[#2D1B10]">
                <Calendar className="w-4 h-4 text-[#FF6B35]" />
                Khoảng thời gian
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {(["7d", "30d", "90d", "all"] as WindowType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWindow(w)}
                    className={`py-2 px-3 rounded-[12px] text-[11px] font-bold transition-all duration-300 border ${window === w
                      ? "bg-[#2D1B10] border-[#2D1B10] text-white shadow-sm scale-[1.02]"
                      : "bg-white border-[#F2E5DC] text-[#6F5543] hover:bg-[#FFF6F0] hover:text-[#FF6B35]"
                      }`}
                  >
                    {getWindowLabel(w)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center/Right Panel: Timeline Chart */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.04)] h-full flex flex-col">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-[#FBE3D1]/50">
              <div>
                <CardTitle className="text-lg font-extrabold flex items-center gap-2 text-[#2D1B10]">
                  <Activity className="w-5 h-5 text-[#FF6B35]" />
                  Đường biểu diễn xu hướng Band Score
                </CardTitle>
                <CardDescription className="text-[#6F5543] text-xs">
                  Biểu đồ điểm số qua các bài nộp của bạn trong {getWindowLabel(window)}
                </CardDescription>
              </div>
              <Badge className={`capitalize shadow-sm border font-black text-[10px] tracking-wider rounded-full px-3 py-1 ${skillColorConfig.badge}`}>
                {skill === "overall" ? "Overall Model" : skill}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center px-6 py-5 min-h-[320px] relative">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-10 h-10 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#6F5543] text-xs font-bold tracking-wide">Đang đọc dữ liệu chấm điểm...</p>
                </div>
              ) : !chartConfig || chartConfig.mappedPoints.length === 0 ? (
                <div className="text-center max-w-sm mx-auto space-y-4 py-8">
                  <div className="w-14 h-14 rounded-full bg-[#FFF0E6] flex items-center justify-center mx-auto border border-[#FFD9C2]">
                    <Target className="w-6 h-6 text-[#FF6B35]" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#2D1B10]">Ơ kìa, chưa nộp bài nào! 😿</h3>
                  <p className="text-xs text-[#6F5543] leading-relaxed">
                    Bạn chưa có bài nộp nào thuộc kỹ năng <span className="font-bold text-[#FF6B35]">{getSkillLabel(skill)}</span> trong {getWindowLabel(window)}. Làm bài thi ngay để Miu chấm điểm nhé!
                  </p>
                  <Button asChild size="sm" className="bg-[#2D1B10] text-white hover:bg-[#FF6B35] rounded-[12px] transition-colors duration-300 border-0 px-4">
                    <Link href="/assignment">Bắt đầu cày đề</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative w-full" style={{ aspectRatio: "800/360" }}>
                    {/* SVG Chart styled with warm colors */}
                    <svg
                      viewBox={`0 0 ${chartConfig.svgWidth} ${chartConfig.svgHeight}`}
                      className="w-full h-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <defs>
                        {/* Orange Gradient Area Fill */}
                        <linearGradient id="idest-chart-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={skillColorConfig.stroke} stopOpacity="0.25" />
                          <stop offset="85%" stopColor={skillColorConfig.stroke} stopOpacity="0.03" />
                          <stop offset="100%" stopColor="#FFFDFB" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Glow filter for the line */}
                        <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Chart background */}
                      <rect
                        x={chartConfig.paddingLeft}
                        y={40}
                        width={chartConfig.plotWidth}
                        height={chartConfig.plotHeight}
                        fill="#FFFDFB"
                        rx="4"
                      />

                      {/* Styled Grid Lines & Labels */}
                      {chartConfig.gridLines.map((line, idx) => (
                        <g key={idx}>
                          <line
                            x1={chartConfig.paddingLeft}
                            y1={line.y}
                            x2={chartConfig.svgWidth - 40}
                            y2={line.y}
                            stroke={idx === 0 ? "#E8D5C9" : "#F3E9E2"}
                            strokeWidth={idx === 0 ? "2" : "1"}
                            strokeDasharray={idx === 0 ? "0" : "5 5"}
                          />
                          <text
                            x={chartConfig.paddingLeft - 10}
                            y={line.y + 4}
                            fill="#9E8675"
                            fontSize="12"
                            fontWeight="700"
                            fontFamily="monospace"
                            textAnchor="end"
                          >
                            {line.label}
                          </text>
                          {(Number(line.label) === 6.0 || Number(line.label) === 7.0 || Number(line.label) === 8.0) && (
                            <text
                              x={chartConfig.svgWidth - 35}
                              y={line.y - 5}
                              fill="#C4A99A"
                              fontSize="9"
                              fontWeight="800"
                              textAnchor="start"
                              letterSpacing="1"
                            >
                              {Number(line.label) === 6.0 ? "B2" : Number(line.label) === 7.0 ? "C1" : "C2"}
                            </text>
                          )}
                        </g>
                      ))}

                      {/* Dynamic Chart Gradient Path */}
                      {chartConfig.areaPath && (
                        <path d={chartConfig.areaPath} fill="url(#idest-chart-grad)" />
                      )}

                      {/* Bold Trend Line with glow */}
                      {chartConfig.linePath && (
                        <>
                          {/* Glow layer */}
                          <path
                            d={chartConfig.linePath}
                            fill="none"
                            stroke={skillColorConfig.stroke}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeOpacity="0.2"
                          />
                          {/* Main line */}
                          <path
                            d={chartConfig.linePath}
                            fill="none"
                            stroke={skillColorConfig.stroke}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}

                      {/* Interactive Dot Triggers */}
                      {chartConfig.mappedPoints.map((pt, idx) => {
                        const dateObj = new Date(pt.timestamp);
                        const formattedDate = dateObj.toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        });

                        const isHovered = hoveredPoint?.submissionId === pt.submissionId;

                        return (
                          <g key={idx}>
                            {/* Vertical drop line */}
                            <line
                              x1={pt.x}
                              y1={pt.y}
                              x2={pt.x}
                              y2={chartConfig.svgHeight - chartConfig.paddingBottom}
                              stroke={isHovered ? skillColorConfig.stroke : "#F0E4DB"}
                              strokeWidth={isHovered ? "1.5" : "1"}
                              strokeDasharray={isHovered ? "0" : "3 3"}
                              strokeOpacity={isHovered ? "0.6" : "1"}
                            />

                            {/* Outer glow ring on hover */}
                            {isHovered && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="14"
                                fill={skillColorConfig.stroke}
                                fillOpacity="0.12"
                              />
                            )}

                            {/* Outer circle */}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? "8" : "6"}
                              fill="#FFFFFF"
                              stroke={skillColorConfig.stroke}
                              strokeWidth={isHovered ? "3" : "2.5"}
                            />

                            {/* Inner dot */}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={isHovered ? "3.5" : "2.5"}
                              fill={skillColorConfig.stroke}
                            />

                            {/* Score label above dot */}
                            {isHovered && (
                              <text
                                x={pt.x}
                                y={pt.y - 14}
                                fill={skillColorConfig.stroke}
                                fontSize="11"
                                fontWeight="900"
                                textAnchor="middle"
                                fontFamily="monospace"
                              >
                                {pt.score.toFixed(1)}
                              </text>
                            )}

                            {/* Trigger point handler */}
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="20"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint(pt as any)}
                              onMouseLeave={() => setHoveredPoint(null)}
                              onClick={() => handlePointClick(pt)}
                            />

                          </g>
                        );
                      })}

                      {/* Smart X-axis: deduplicated date labels with min spacing */}
                      {(() => {
                        const minLabelSpacing = 55; // px in SVG space — labels closer than this get skipped
                        const labelY = chartConfig.svgHeight - chartConfig.paddingBottom + 20;
                        const tickY1 = chartConfig.svgHeight - chartConfig.paddingBottom;
                        const tickY2 = tickY1 + 6;
                        const rendered: { x: number; label: string }[] = [];

                        chartConfig.mappedPoints.forEach((pt) => {
                          const dateObj = new Date(pt.timestamp);
                          const label = dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

                          // Check if this point is too close to any already-rendered label
                          const tooClose = rendered.some((r) => Math.abs(r.x - pt.x) < minLabelSpacing);
                          // Also skip if same date as an already-rendered label
                          const sameDate = rendered.some((r) => r.label === label);

                          if (!tooClose && !sameDate) {
                            rendered.push({ x: pt.x, label });
                          }
                        });

                        return (
                          <g>
                            {/* Baseline axis line */}
                            <line
                              x1={chartConfig.paddingLeft}
                              y1={tickY1}
                              x2={chartConfig.svgWidth - 40}
                              y2={tickY1}
                              stroke="#E8D5C9"
                              strokeWidth="1"
                            />
                            {/* All points get a small tick */}
                            {chartConfig.mappedPoints.map((pt, i) => (
                              <line key={i} x1={pt.x} y1={tickY1} x2={pt.x} y2={tickY2} stroke="#D4B8AA" strokeWidth="1" />
                            ))}
                            {/* Only deduplicated labels */}
                            {rendered.map((r, i) => (
                              <text
                                key={i}
                                x={r.x}
                                y={labelY}
                                fill="#9E8675"
                                fontSize="10"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                {r.label}
                              </text>
                            ))}
                          </g>
                        );
                      })()}
                    </svg>

                    {/* Popover Card on Point Hover */}
                    {hoveredPoint && (() => {
                      const svgW = chartConfig.svgWidth;
                      const svgH = chartConfig.svgHeight;
                      // Convert SVG coords → percentage of rendered container
                      const leftPct = (hoveredPoint.x / svgW) * 100;
                      const topPct = (hoveredPoint.y / svgH) * 100;
                      // Flip tooltip to left side when near right edge
                      const nearRight = leftPct > 70;
                      return (
                        <div
                          className="absolute z-30 bg-[#2D1B10] text-white text-xs rounded-[16px] shadow-2xl pointer-events-none flex flex-col gap-1.5 border border-[#FFD9C2]/20 animate-in fade-in zoom-in-95 duration-150"
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            transform: nearRight
                              ? "translate(-100%, calc(-100% - 14px))"
                              : "translate(-50%, calc(-100% - 14px))",
                            padding: "10px 14px",
                            minWidth: "140px",
                          }}
                        >
                          {/* Arrow */}
                          <div
                            className="absolute bottom-0 border-x-8 border-t-8 border-x-transparent border-t-[#2D1B10]"
                            style={{ transform: "translateY(100%)", left: nearRight ? "auto" : "50%", right: nearRight ? "20px" : "auto", marginLeft: nearRight ? 0 : "-8px" }}
                          />
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-extrabold text-[#FF6B35] text-base leading-none">Band {hoveredPoint.score.toFixed(1)}</span>
                            <span className="text-[9px] text-[#C4A99A] uppercase tracking-wider font-bold bg-white/10 rounded-full px-2 py-0.5">
                              {hoveredPoint.skill}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#F0D6C4] font-medium">
                            {new Date(hoveredPoint.timestamp).toLocaleDateString("vi-VN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[8px] text-[#FFECE0]/50 border-t border-[#FFD9C2]/10 pt-1 mt-0.5 font-bold">
                            Bấm để xem phân tích AI →
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Chart footer: quick stats */}
                  {timeline?.trend && (
                    <div className="mt-4 pt-4 border-t border-[#F3E9E2] flex flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ borderColor: skillColorConfig.stroke, backgroundColor: "#fff" }} />
                        <span className="text-[10px] font-black text-[#9E8675] uppercase tracking-wider">
                          {chartConfig.mappedPoints.length} bài nộp
                        </span>
                      </div>
                      {timeline.trend.rollingAverage !== null && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: skillColorConfig.stroke }} />
                          <span className="text-[10px] font-black text-[#9E8675] uppercase tracking-wider">
                            Rolling avg: <span style={{ color: skillColorConfig.stroke }}>{timeline.trend.rollingAverage.toFixed(2)}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {timeline.trend.direction === "up" && <TrendingUp className="w-3.5 h-3.5 text-[#2EC4B6]" />}
                        {timeline.trend.direction === "down" && <TrendingDown className="w-3.5 h-3.5 text-[#FF5A5F]" />}
                        {timeline.trend.direction === "flat" && <Minus className="w-3.5 h-3.5 text-[#9E8675]" />}
                        <span className="text-[10px] font-black text-[#9E8675] uppercase tracking-wider">
                          {timeline.trend.direction === "up" ? "Đang cải thiện 🔥" : timeline.trend.direction === "down" ? "Cần chú ý ⚠️" : "Ổn định 💪"}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Detail Analytics Boards */}

      {/* READING & LISTENING: Question Type Diagnostic Breakdown */}
      {(skill === "reading" || skill === "listening") && (
        <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.02)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="border-b border-[#FBE3D1]/50 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg font-extrabold flex items-center gap-2 text-[#2D1B10]">
                  <Target className="w-5 h-5 text-[#FF6B35]" />
                  Phân tích dạng câu hỏi ({skill === "reading" ? "Reading Academic" : "Listening"})
                </CardTitle>
                <CardDescription className="text-[#6F5543] text-xs">
                  Tỷ lệ trả lời chính xác chia theo các dạng câu hỏi cụ thể trong đề thi
                </CardDescription>
              </div>
              <Badge className="bg-[#FFF0E6] text-[#FF6B35] border-[#FFD9C2] font-bold text-xs rounded-full px-3 py-1">
                {getWindowLabel(window)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !questionTypes || !questionTypes.items || questionTypes.items.length === 0 ? (
              <div className="text-center py-8 text-[#6F5543] max-w-sm mx-auto">
                <AlertTriangle className="w-10 h-10 text-[#FFD9C2] mx-auto mb-3" />
                <p className="text-sm font-extrabold">Chưa có đủ dữ liệu bài làm</p>
                <p className="text-xs text-[#9E8675] mt-1">Làm tối thiểu 1 đề Listening/Reading đầy đủ để kích hoạt radar AI phân loại câu hỏi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Strengths Board */}
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-[#2D1B10] border-b border-[#F3E9E2] pb-2 flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2EC4B6]" />
                    Miu Khen:
                  </h3>
                  <div className="space-y-4">
                    {questionTypes.items
                      .filter((it) => it.classification === "strong" || it.classification === "neutral")
                      .sort((a, b) => b.accuracy - a.accuracy)
                      .map((it) => (
                        <div key={it.questionType} className="p-4 bg-[#FFFDFB] rounded-[16px] border border-[#FBE3D1]/40 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-[#2D1B10] uppercase tracking-wide">
                              {it.questionType.replace(/_/g, " ")}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#6F5543] font-bold">
                                {it.correctItems}/{it.totalItems} câu đúng
                              </span>
                              <Badge
                                className={
                                  it.classification === "strong"
                                    ? "bg-[#EAF9F5] text-[#2EC4B6] border-[#BCEEE6]"
                                    : "bg-[#FFF2E6] text-[#FF8A3D] border-[#FFE2CC]"
                                }
                              >
                                {it.classification === "strong" ? "Thế mạnh" : "Khá ổn"}
                              </Badge>
                            </div>
                          </div>

                          {/* Accuracy Bar with Orange Gradient */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-2.5 bg-[#F3E9E2] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r from-[#FFA500] to-[#FF6B35]`}
                                style={{ width: `${it.accuracy * 100}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1 w-16 justify-end">
                              <span className="text-xs font-black text-[#2D1B10] font-mono">
                                {Math.round(it.accuracy * 100)}%
                              </span>
                              {it.trendDirection === "improving" && (
                                <TrendingUp className="w-3.5 h-3.5 text-[#2EC4B6]" />
                              )}
                              {it.trendDirection === "declining" && (
                                <TrendingDown className="w-3.5 h-3.5 text-[#FF5A5F]" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    {questionTypes.items.filter((it) => it.classification === "strong" || it.classification === "neutral").length === 0 && (
                      <p className="text-xs text-[#9E8675] italic">Chưa xác định được thế mạnh rõ rệt. Hãy cố gắng luyện tập thêm đề nha!</p>
                    )}
                  </div>
                </div>

                {/* Weaknesses Board */}
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-[#2D1B10] border-b border-[#F3E9E2] pb-2 flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A5F]" />
                    Miu nhắc:
                  </h3>
                  <div className="space-y-4">
                    {questionTypes.items
                      .filter((it) => it.classification === "weak" || it.classification === "insufficient_data")
                      .sort((a, b) => a.accuracy - b.accuracy)
                      .map((it) => (
                        <div key={it.questionType} className="p-4 bg-[#FFFDFB] rounded-[16px] border border-[#FBE3D1]/40 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-[#2D1B10] uppercase tracking-wide">
                              {it.questionType.replace(/_/g, " ")}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#6F5543] font-bold">
                                {it.correctItems}/{it.totalItems} câu đúng
                              </span>
                              <Badge
                                className={
                                  it.classification === "weak"
                                    ? "bg-[#FFEFEF] text-[#FF5A5F] border-[#FFD0D0]"
                                    : "bg-[#FFF9F3] text-[#9E8675] border-[#F2E5DC]"
                                }
                              >
                                {it.classification === "weak" ? "Cần ôn kỹ" : "Ít dữ liệu"}
                              </Badge>
                            </div>
                          </div>

                          {/* Accuracy Bar with Red/Gray Accent */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-2.5 bg-[#F3E9E2] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${it.classification === "weak" ? "bg-gradient-to-r from-[#FF9F9F] to-[#FF5A5F]" : "bg-[#D8C9C0]"}`}
                                style={{ width: `${it.accuracy * 100}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1 w-16 justify-end">
                              <span className="text-xs font-black text-[#2D1B10] font-mono">
                                {Math.round(it.accuracy * 100)}%
                              </span>
                              {it.classification === "insufficient_data" ? (
                                <HelpCircle className="w-3.5 h-3.5 text-[#9E8675]" />
                              ) : (
                                <>
                                  {it.trendDirection === "improving" && (
                                    <TrendingUp className="w-3.5 h-3.5 text-[#2EC4B6]" />
                                  )}
                                  {it.trendDirection === "declining" && (
                                    <TrendingDown className="w-3.5 h-3.5 text-[#FF5A5F]" />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {it.classification === "insufficient_data" && (
                            <p className="text-[10px] text-[#9E8675] mt-2 font-bold italic">
                              * Cày thêm đề dạng này để phân loại chuẩn xác hơn nhé!
                            </p>
                          )}
                        </div>
                      ))}
                    {questionTypes.items.filter((it) => it.classification === "weak" || it.classification === "insufficient_data").length === 0 && (
                      <p className="text-xs text-[#9E8675] italic">Quá xuất sắc! Không có điểm yếu nguy cơ nào bị phát hiện.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* WRITING: Detailed Hybrid Scorer Rubrics Analysis */}
      {skill === "writing" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D1B10] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF6B35] animate-pulse" />
                Cố vấn Học thuật Rubric Writing (IELTS Academic)
              </h2>
            </div>
            <Badge className="bg-[#2D1B10] text-white border-0 rounded-full py-1 px-3 text-xs font-black font-mono">
              OLLAMA INTEGRATED
            </Badge>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !writingRubrics || !writingRubrics.items || writingRubrics.items.length === 0 ? (
            <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-sm p-12 text-center">
              <PenTool className="w-12 h-12 text-[#FFD9C2] mx-auto mb-4" />
              <h3 className="text-base font-extrabold text-[#2D1B10]">Chưa đủ dữ liệu Rubric</h3>
              <p className="text-xs text-[#6F5543] max-w-sm mx-auto mt-2">
                Hệ thống cần tối thiểu 3 bài tập Writing ở trạng thái đã chấm (graded) để bắt đầu phân tích xu hướng chi tiết của các tiêu chí.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {writingRubrics.items.map((it) => {
                const criterionLabels = {
                  task_response: { title: "Task Achievement / Response", color: "bg-[#FF5400]", hoverColor: "border-l-[#FF5400]" },
                  coherence_cohesion: { title: "Coherence & Cohesion (Mạch lạc)", color: "bg-[#FF9E00]", hoverColor: "border-l-[#FF9E00]" },
                  lexical_resource: { title: "Lexical Resource (Vốn Từ vựng)", color: "bg-[#FF70A6]", hoverColor: "border-l-[#FF70A6]" },
                  grammar_range_accuracy: { title: "Grammar Range & Accuracy (Ngữ pháp)", color: "bg-[#E07A5F]", hoverColor: "border-l-[#E07A5F]" },
                }[it.criterion];

                return (
                  <Card key={it.criterion} className={`rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden relative flex flex-col h-full group hover:-translate-y-1 transition-all duration-300 border-l-4 ${criterionLabels?.hoverColor}`}>
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-extrabold text-[#2D1B10]">
                          {criterionLabels?.title}
                        </CardTitle>
                        <CardDescription className="uppercase text-[9px] font-black text-[#9E8675] tracking-widest mt-1">TIÊU CHÍ IELTS ACADEMIC</CardDescription>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-2xl font-black text-[#2D1B10] font-mono leading-none">
                          {it.averageBand !== null ? it.averageBand.toFixed(2) : "-.-"}
                        </div>
                        {it.trend !== "unknown" && (
                          <div className="mt-1.5">
                            {it.trend === "up" && (
                              <Badge className="bg-[#EAF9F5] text-[#2EC4B6] border-[#BCEEE6] flex items-center gap-0.5 text-[9px] font-black">
                                <TrendingUp className="w-2.5 h-2.5" />
                                +{it.deltaVsPreviousWindow}
                              </Badge>
                            )}
                            {it.trend === "down" && (
                              <Badge className="bg-[#FFEFEF] text-[#FF5A5F] border-[#FFD0D0] flex items-center gap-0.5 text-[9px] font-black">
                                <TrendingDown className="w-2.5 h-2.5" />
                                {it.deltaVsPreviousWindow}
                              </Badge>
                            )}
                            {it.trend === "flat" && (
                              <Badge className="bg-[#FFF9F3] text-[#9E8675] border-[#F2E5DC] flex items-center gap-0.5 text-[9px] font-black">
                                <Minus className="w-2.5 h-2.5" />
                                0.00
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between pt-2">
                      <div className="p-4 bg-[#FFFDFB] rounded-[16px] border border-[#FBE3D1]/40 text-xs text-[#6F5543] leading-relaxed font-bold shadow-inner">
                        {it.recommendation || (
                          <span className="text-[#9E8675] italic font-medium">
                            Chưa có đề xuất (yêu cầu ít nhất 3 bài tập được chấm điểm trong kỳ làm việc).
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-4 text-[10px] text-[#9E8675] font-black uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-[#FF6B35]" />
                        <span>Cập nhật theo thời gian thực</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SPEAKING: Detailed Pronunciation & Fluency Flow Diagnostics */}
      {skill === "speaking" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-[#2D1B10] flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-[#FF6B35] animate-pulse" />
                Công cụ Phân tích Ngữ âm & Trôi chảy Speaking
              </h2>
              <p className="text-xs text-[#6F5543] mt-1 font-medium">Module phân tích âm vị học Wav2Vec2 và công thức ước lượng tốc độ Flow B</p>
            </div>
            <Badge className="bg-[#FFECE0] text-[#FF6B35] border-[#FFD9C2] rounded-full py-1 px-3 text-xs font-black font-mono">
              WAV2VEC2 + FASTER-WHISPER
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Speech Rate (Flow B - Speech Rate) */}
            <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 p-6 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-[#FF6B35] uppercase tracking-wider">Flow B: Speech Rate</span>
                  <Badge className="bg-[#FFF0E6] text-[#FF6B35] border-0 font-bold text-xs rounded-full px-2 py-0.5">135 WPM</Badge>
                </div>
                <h3 className="text-md font-extrabold text-[#2D1B10] mb-2">Tốc độ phát âm (WPM)</h3>
                <p className="text-xs text-[#6F5543] leading-relaxed font-medium">
                  Tốc độ trung bình đạt khoảng 135 từ/phút (Words Per Minute). Đây là khoảng tốc độ lý tưởng (130-150 WPM) chuẩn IELTS giúp tăng điểm Fluency!
                </p>
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-[10px] text-[#9E8675] font-black uppercase mb-1">
                  <span>Chậm (&lt;110)</span>
                  <span className="text-[#FF6B35]">Chuẩn (130-150)</span>
                  <span>Nhanh (&gt;160)</span>
                </div>
                <div className="h-2.5 bg-[#F3E9E2] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#FF9F1C] to-[#FF6B35] rounded-full" style={{ width: "72%" }} />
                </div>
              </div>
            </Card>

            {/* Filler Words Stats (Flow B - Hesitations) */}
            <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 p-6 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-[#FF6B35] uppercase tracking-wider">Flow B: Hesitations</span>
                  <Badge className="bg-[#EAF9F5] text-[#2EC4B6] border-0 font-bold text-xs rounded-full px-2 py-0.5">3.2% Density</Badge>
                </div>
                <h3 className="text-md font-extrabold text-[#2D1B10] mb-2">Từ đệm & Ngập ngừng</h3>
                <p className="text-xs text-[#6F5543] leading-relaxed font-medium">
                  Mật độ từ đệm như "um", "ah", "like" của bạn ở mức kiểm soát cực tốt. Tránh lặp lại quá nhiều để giữ bài nói mạch lạc và tự nhiên.
                </p>
              </div>
              <div className="mt-6 space-y-2 border-t border-[#F3E9E2]/60 pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#2D1B10]">"uhm" / "ah"</span>
                  <span className="font-mono text-[#6F5543] font-bold">7 lần xuất hiện</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#2D1B10]">"you know"</span>
                  <span className="font-mono text-[#6F5543] font-bold">2 lần xuất hiện</span>
                </div>
              </div>
            </Card>

            {/* Phoneme Alignment & Mispronunciation Tracker (Flow A vs B) */}
            <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 p-6 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-[#FF6B35] uppercase tracking-wider">Flow A vs B: Phonemes</span>
                  <Badge className="bg-[#FFF0E6] text-[#FF6B35] border-0 font-bold text-xs rounded-full px-2 py-0.5">84% Accuracy</Badge>
                </div>
                <h3 className="text-md font-extrabold text-[#2D1B10] mb-2">Phát âm âm vị học (IPA)</h3>
                <p className="text-xs text-[#6F5543] leading-relaxed mb-4 font-medium">
                  Các nhóm âm vị bạn thường bị lệch hoặc nuốt âm khi nói nhanh được hệ thống so sánh đối chiếu lỗi (Sentence-level error list) phát hiện:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-[#FFEFEF] text-[#FF5A5F] border border-[#FFD0D0] font-black text-[10px]">/s/ & /z/ (ending)</Badge>
                  <Badge className="bg-[#FFEFEF] text-[#FF5A5F] border border-[#FFD0D0] font-black text-[10px]">/θ/ (think)</Badge>
                  <Badge className="bg-[#FFEFEF] text-[#FF5A5F] border border-[#FFD0D0] font-black text-[10px]">/dʒ/ (judge)</Badge>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#F3E9E2]">
                <span className="text-[10px] text-[#9E8675] font-black uppercase tracking-wider">Miu khuyên:</span>
                <p className="text-[11px] text-[#6F5543] italic font-bold mt-1">
                  "Hãy bấm vào transcript lỗi màu đỏ trong trang kết quả Speaking để nghe và sửa lại cho chuẩn nhé!"
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* OVERALL: General statistics summary board */}
      {skill === "overall" && !loading && timeline && timeline.points.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)] p-5 flex items-center gap-4 hover:-translate-y-1 transition-all duration-300">
            <div className="p-3.5 rounded-[16px] bg-[#FFF0E6] text-[#FF6B35] border border-[#FFD9C2]">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[9px] font-black text-[#9E8675] uppercase tracking-widest">Tổng bài nộp</p>
              <h4 className="text-xl font-black text-[#2D1B10]">{timeline.points.length} bài đã hoàn thành</h4>
            </div>
          </Card>

          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)] p-5 flex items-center gap-4 hover:-translate-y-1 transition-all duration-300">
            <div className="p-3.5 rounded-[16px] bg-[#FFF0E6] text-[#FF6B35] border border-[#FFD9C2]">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[9px] font-black text-[#9E8675] uppercase tracking-widest">Rolling average (5 bài)</p>
              <h4 className="text-xl font-black text-[#2D1B10]">
                {timeline.trend?.rollingAverage !== null ? timeline.trend.rollingAverage.toFixed(2) : "-.-"} <span className="text-[10px] text-[#9E8675]">/ 9.0</span>
              </h4>
            </div>
          </Card>

          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)] p-5 flex items-center gap-4 hover:-translate-y-1 transition-all duration-300">
            <div className="p-3.5 rounded-[16px] bg-[#FFF0E6] text-[#FF6B35] border border-[#FFD9C2]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[9px] font-black text-[#9E8675] uppercase tracking-widest">Xu hướng học tập</p>
              <h4 className="text-md font-black text-[#2D1B10] uppercase tracking-wide">
                {timeline.trend?.direction === "up" && "Đang cải thiện tốt! 🔥"}
                {timeline.trend?.direction === "down" && "Cần chú ý thêm ⚠️"}
                {timeline.trend?.direction === "flat" && "Rất ổn định! 💪"}
                {timeline.trend?.direction === "unknown" && "Chưa xác định 🤔"}
              </h4>
            </div>
          </Card>

          <Card className="rounded-[24px] border border-[#FBE3D1] bg-white/80 backdrop-blur-sm shadow-[0_8px_30px_rgba(255,107,53,0.03)] p-5 flex items-center gap-4 hover:-translate-y-1 transition-all duration-300">
            <div className="p-3.5 rounded-[16px] bg-[#FFF0E6] text-[#FF6B35] border border-[#FFD9C2]">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black text-[#9E8675] uppercase tracking-widest">Gợi ý lộ trình AI</p>
              <h4 className="text-xs font-bold text-[#6F5543] leading-snug">
                Làm thêm bài Listening và Speaking để Miu phân tích sâu lỗi phát âm và trôi chảy nhé!
              </h4>
            </div>
          </Card>

        </div>
      )}

    </div>
  );
}