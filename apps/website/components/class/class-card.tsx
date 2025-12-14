"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClassData } from "@/types/class";
import { BookOpen, Users } from "lucide-react";

export default function ClassCard({ cls }: { cls: ClassData }) {
  const router = useRouter();

  return (
    <Card
      key={cls.id}
      className="group relative overflow-hidden border border-gray-200 hover:border-gray-900 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white"
      onClick={() => router.push(`/classes/${cls.slug}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
              <BookOpen className="w-5 h-5 text-gray-900" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-semibold text-gray-900 line-clamp-1">
                {cls.name}
              </CardTitle>
            </div>
          </div>
        </div>
        <CardDescription className="text-gray-600 mt-2 line-clamp-2">
          {cls.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 relative">
        {/* Schedule Info
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="font-semibold text-gray-700">{cls.schedule.time}</span>
            <Badge variant="secondary" className="text-xs">
              {cls.schedule.timezone}
            </Badge>
          </div>

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {cls.schedule.days.map((day) => (
                <Badge 
                  key={day} 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs capitalize px-2 py-0.5"
                >
                  {day}
                </Badge>
              ))}
            </div>
          </div>
        </div> */}

        {/* Stats */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Users className="w-4 h-4 text-gray-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Thành viên</p>
              <p className="text-sm font-semibold text-gray-900">{cls._count.members}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <BookOpen className="w-4 h-4 text-gray-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Buổi học</p>
              <p className="text-sm font-semibold text-gray-900">{cls._count.sessions}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
