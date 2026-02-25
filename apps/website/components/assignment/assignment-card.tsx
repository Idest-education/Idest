import { AssignmentOverview } from "@/types/assignment";
import Link from "next/link";
import { BookOpen, Calendar, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AssignmentCard({ item }: { item: AssignmentOverview }) {
    const link = `/assignment/${item.skill}/${item.id}`;
    const skillConfig = getSkillConfig(item.skill);

    return (
        <Link href={link}>
            <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:border-transparent cursor-pointer animate-in fade-in slide-in-from-bottom-4">
                {/* Dark gradient overlay on hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br ${skillConfig.darkGradient} z-10`} />
                
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
                                <div className={`p-2.5 rounded-lg ${skillConfig.bgColor} ${skillConfig.textColor} group-hover:bg-white/20 group-hover:text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <Badge 
                                    className={`${skillConfig.badgeClass} border-0 text-xs font-medium capitalize group-hover:bg-white/20 group-hover:text-white group-hover:backdrop-blur-sm transition-all duration-500`}
                                >
                                    {item.skill}
                                </Badge>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-white transition-all duration-500 line-clamp-2 group-hover:scale-[1.02]">
                                {item.title}
                            </h3>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 group-hover:text-white/90 line-clamp-3 mb-4 flex-1 transition-all duration-500 group-hover:translate-x-1">
                        {item.description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 group-hover:border-white/20 transition-all duration-500">
                        <div className="flex items-center gap-2 text-xs text-gray-500 group-hover:text-white/80 transition-all duration-500 group-hover:scale-105">
                            <Calendar className="w-3 h-3 group-hover:rotate-12 transition-transform duration-500" />
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
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
        </Link>
    );
}

function getSkillConfig(skill: string) {
    switch (skill) {
        case "reading":
            return {
                darkGradient: "from-gray-900 via-blue-900 to-indigo-900",
                bgColor: "bg-blue-100",
                textColor: "text-blue-600",
                badgeClass: "bg-blue-500 text-white",
            };
        case "listening":
            return {
                darkGradient: "from-gray-900 via-emerald-900 to-teal-900",
                bgColor: "bg-emerald-100",
                textColor: "text-emerald-600",
                badgeClass: "bg-emerald-500 text-white",
            };
        case "writing":
            return {
                darkGradient: "from-gray-900 via-amber-900 to-orange-900",
                bgColor: "bg-amber-100",
                textColor: "text-amber-600",
                badgeClass: "bg-amber-500 text-white",
            };
        case "speaking":
            return {
                darkGradient: "from-gray-900 via-red-900 to-rose-900",
                bgColor: "bg-red-100",
                textColor: "text-red-600",
                badgeClass: "bg-red-500 text-white",
            };
        default:
            return {
                darkGradient: "from-gray-900 to-gray-800",
                bgColor: "bg-gray-100",
                textColor: "text-gray-600",
                badgeClass: "bg-gray-500 text-white",
            };
    }
}
