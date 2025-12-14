"use client";

import { useEffect, useState } from "react";
import { getAssignments } from "@/services/assignment.service";
import type { AssignmentOverview, AssignmentResponse } from "@/types/assignment";
import AssignmentCard from "./assignment-card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AssignmentShowcaseClient() {
  const [assignments, setAssignments] = useState<AssignmentOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await getAssignments({ page: 1, limit: 6 });
        
        // Combine all skills into a single array
        const allAssignments: AssignmentOverview[] = [];
        
        const addAssignments = (skillData: AssignmentOverview[] | any) => {
          if (Array.isArray(skillData)) {
            allAssignments.push(...skillData);
          } else if (skillData && typeof skillData === 'object' && 'data' in skillData) {
            allAssignments.push(...skillData.data);
          }
        };

        addAssignments(response.reading);
        addAssignments(response.listening);
        addAssignments(response.writing);
        addAssignments(response.speaking);

        // Take first 6 assignments
        setAssignments(allAssignments.slice(0, 6));
      } catch (error) {
        console.error("Failed to load assignments:", error);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
          <p className="text-gray-600 text-sm">Đang tải bài tập...</p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 via-pink-100 to-indigo-100 text-xs font-medium text-gray-800 shadow-sm mb-4">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Luyện tập tạo nên sự hoàn hảo
        </div>
        <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">
          Bài tập nổi bật
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Khám phá bộ sưu tập bài tập luyện thi IELTS được tuyển chọn qua tất cả các kỹ năng.
        </p>
      </div>

      {/* Assignment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {assignments.map((item, index) => (
          <div
            key={item.id}
            className="animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
          >
            <AssignmentCard item={item} />
          </div>
        ))}
      </div>

      {/* Explore More Button */}
      <div className="text-center">
        <Link href="/assignment" className="inline-block group">
          <Button
            size="lg"
            className="relative overflow-visible bg-gradient-to-r from-gray-900 via-indigo-900 via-purple-900 to-gray-800 text-white font-extrabold text-xl px-12 py-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-all duration-700 hover:scale-150 hover:rotate-3 hover:bg-gradient-to-r hover:from-pink-200 hover:via-purple-200 hover:via-indigo-200 hover:to-blue-200 hover:text-gray-900 hover:shadow-[0_0_80px_rgba(236,72,153,0.6),0_0_120px_rgba(139,92,246,0.5)] hover:brightness-110 animate-bounce-soft border-4 border-white/60 hover:border-white/90 hover:border-8"
          >
            {/* Animated gradient overlay */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            
            {/* Glowing background effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700 -z-10 scale-150" />
            
            {/* Pulsing ring effect */}
            <span className="absolute -inset-4 rounded-3xl border-4 border-white/0 group-hover:border-white/80 group-hover:scale-150 group-hover:animate-ping transition-all duration-700" />
            
            {/* Content */}
            <span className="relative z-10 flex items-center gap-4">
              <span className="group-hover:scale-125 group-hover:tracking-widest group-hover:animate-pulse transition-all duration-700 inline-block uppercase">
                KHÁM PHÁ THÊM BÀI TẬP
              </span>
              <ArrowRight className="w-8 h-8 ml-2 group-hover:translate-x-8 group-hover:rotate-90 group-hover:scale-250 transition-all duration-700" />
            </span>
            
            {/* Floating particles effect - more particles */}
            <span className="absolute top-2 left-1/4 w-4 h-4 bg-yellow-300 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up shadow-lg" />
            <span className="absolute top-2 right-1/4 w-4 h-4 bg-pink-300 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up group-hover:animation-delay-200 shadow-lg" />
            <span className="absolute bottom-2 left-1/3 w-4 h-4 bg-blue-300 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up group-hover:animation-delay-400 shadow-lg" />
            <span className="absolute top-1/2 right-1/3 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up group-hover:animation-delay-600 shadow-lg" />
            <span className="absolute top-1/4 left-1/2 w-3 h-3 bg-purple-300 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up group-hover:animation-delay-300 shadow-lg" />
            <span className="absolute bottom-1/4 right-1/2 w-3 h-3 bg-indigo-300 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-float-up group-hover:animation-delay-500 shadow-lg" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

