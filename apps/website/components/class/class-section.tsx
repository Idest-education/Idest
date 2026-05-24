import ClassCard from "./class-card";
import { ClassData } from "@/types/class";

export default function ClassesSection({
  title,
  classes,
}: {
  title?: string;
  classes: ClassData[];
}) {
  return (
    <section>
      {title && (
        <h2
          className="font-semibold mb-4"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontSize: 20,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls, index) => (
          <ClassCard key={cls.id} cls={cls} index={index} />
        ))}
      </div>
    </section>
  );
}
