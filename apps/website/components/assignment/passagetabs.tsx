import { SectionV2Client } from "@/types/assignment";

interface Props {
    sections: SectionV2Client[];
    active: number;
    setActive: (index: number) => void;
}

export default function PassageTabs({ sections, active, setActive }: Props) {
    return (
        <div className="flex gap-3 mb-3">
            {sections.map((sec, idx) => (
                <button
                    key={sec.id}
                    onClick={() => setActive(idx)}
                    className={`px-4 py-2 rounded-full border ${active === idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
                        }`}
                >
                    Bài đọc {idx + 1}
                </button>
            ))}
        </div>
    );
}
