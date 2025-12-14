import ClassCard from "./class-card";
import { ClassData } from "@/types/class";

export default function ClassesSection({
  title,
  classes,
}: {
  title: string;
  classes: ClassData[];
}) {
  return (
    <section>
      {title && <h2 className="text-xl text-black font-semibold mb-4">{title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls, index) => (
          <div
            key={cls.id}
            className="animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
          >
            <ClassCard cls={cls} />
          </div>
        ))}
      </div>
    </section>
  );
}
