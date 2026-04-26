import { SectionV2Client } from "@/types/assignment";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
    section: SectionV2Client;
}

export default function PassageContent({ section }: Props) {
    const rm = (section as any).material;

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-3">{section.title}</h2>

            {rm?.type === "reading" && rm.images?.length ? (
                <div className="space-y-3 mb-3">
                    {rm.images.map((img: any) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={img.id} src={img.url} className="w-full rounded" alt={img.alt || img.title || "image"} />
                    ))}
                </div>
            ) : null}

            {rm?.type === "reading" ? (
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {rm.document_md || ""}
                    </ReactMarkdown>
                </div>
            ) : null}
        </div>
    );
}
