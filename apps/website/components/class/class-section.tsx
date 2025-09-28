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
      <h2 className="text-xl text-black font-semibold mb-4">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <ClassCard key={cls.id} cls={cls} />
        ))}
      </div>
    </section>
  );
}
