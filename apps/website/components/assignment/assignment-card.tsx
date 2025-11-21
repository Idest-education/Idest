import { AssignmentOverview } from "@/types/assignment";
import Link from "next/link";

export default function AssignmentCard({ item }: { item: AssignmentOverview }) {
    const link = `/assignment/${item.skill}/${item.id}`;

    return (
        <div className="p-5 bg-white rounded-lg border shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold">{item.title}</h3>

                <span
                    className={`px-3 py-1 rounded-full text-sm capitalize text-white`}
                    style={{ backgroundColor: getSkillColor(item.skill) }}
                >
                    {item.skill}
                </span>
            </div>

            <p className="text-gray-600 line-clamp-2">{item.description}</p>

            <div className="mt-3 flex justify-between items-center">
                <p className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                </p>

                <Link href={link} className="text-blue-600 hover:underline text-sm">
                    View
                </Link>
            </div>
        </div>
    );
}

function getSkillColor(skill: string) {
    switch (skill) {
        case "reading":
            return "#3B82F6";
        case "listening":
            return "#10B981";
        case "writing":
            return "#F59E0B";
        case "speaking":
            return "#EF4444";
        default:
            return "#6B7280";
    }
}
