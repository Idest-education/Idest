"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassData } from "@/types/class";
import { BookOpen, Users, Calendar, Clock, Code } from "lucide-react";

export default function ClassCard({ cls }: { cls: ClassData }) {
  const router = useRouter();

  return (
    <Card
      key={cls.id}
      className="group relative overflow-hidden border-2 border-transparent hover:border-indigo-300 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-indigo-50/30"
      onClick={() => router.push(`/protected/classes/${cls.id}`)}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-bl-full transform translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Members</p>
              <p className="text-sm font-bold text-gray-800">{cls._count.members}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BookOpen className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sessions</p>
              <p className="text-sm font-bold text-gray-800">{cls._count.sessions}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
