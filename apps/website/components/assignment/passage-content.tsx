import { ReadingSection } from "@/types/assignment";

interface Props {
    section: ReadingSection;
}

export default function PassageContent({ section }: Props) {
    const rm = section.reading_material;

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-3">{section.title}</h2>

            {rm.image_url && (
                <img src={rm.image_url} className="w-full rounded mb-3" />
            )}

            <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                {rm.document}
            </p>
        </div>
    );
}
