"use client";

import { useRouter } from "next/navigation";
import { ClassData } from "@/types/class";
import { BookOpen, Users, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ClassCard({ cls }: { cls: ClassData }) {
  const router = useRouter();
  const classConfig = getClassConfig();

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:border-transparent cursor-pointer animate-in fade-in slide-in-from-bottom-4"
      onClick={() => router.push(`/classes/${cls.slug}`)}
    >
      {/* Dark gradient overlay on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br ${classConfig.darkGradient} z-10`} />
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
      </div>
      
      {/* Content */}
      <div className="relative p-6 flex flex-col h-full z-20">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2.5 rounded-lg ${classConfig.bgColor} ${classConfig.textColor} group-hover:bg-white/20 group-hover:text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <Badge 
                className={`${classConfig.badgeClass} border-0 text-xs font-medium group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm transition-all duration-500`}
              >
                Lớp học
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-white transition-all duration-500 line-clamp-2 group-hover:scale-[1.02]">
              {cls.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 group-hover:text-white/90 line-clamp-3 mb-4 flex-1 transition-all duration-500 group-hover:translate-x-1">
          {cls.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 pt-4 border-t border-gray-200 group-hover:border-white/20 transition-all duration-500">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${classConfig.bgColor} ${classConfig.textColor} group-hover:bg-white/20 group-hover:text-white transition-all duration-500`}>
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 group-hover:text-white/80 transition-all duration-500">Thành viên</p>
              <p className="text-sm font-bold text-gray-900 group-hover:text-white transition-all duration-500">{cls._count.members}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${classConfig.bgColor} ${classConfig.textColor} group-hover:bg-white/20 group-hover:text-white transition-all duration-500`}>
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 group-hover:text-white/80 transition-all duration-500">Buổi học</p>
              <p className="text-sm font-bold text-gray-900 group-hover:text-white transition-all duration-500">{cls._count.sessions}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 group-hover:border-white/20 transition-all duration-500 mt-auto">
          <div className="text-xs text-gray-500 group-hover:text-white/80 transition-all duration-500 group-hover:scale-105">
            Nhấp để xem chi tiết
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm text-gray-700 hover:text-gray-900 transition-all duration-500 group-hover:scale-105 group-hover:shadow-lg"
          >
            Xem chi tiết
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-2 transition-transform duration-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getClassConfig() {
  return {
    darkGradient: "from-gray-900 via-orange-900 to-orange-800",
    bgColor: "bg-orange-100",
    textColor: "text-orange-600",
    badgeClass: "bg-orange-500 text-white",
  };
}
