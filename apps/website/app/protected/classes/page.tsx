"use client";

import { useEffect, useState } from "react";
import { getClasses } from "@/services/class.service";
import ClassesSection from "@/components/class/class-section";
import { ClassResponse } from "@/types/class";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassResponse>({
    created: [],
    teaching: [],
    enrolled: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClasses()
      .then((data) => {
        setClasses(data?.data || { created: [], teaching: [], enrolled: [] });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-black">Loading...</p>;

  return (
    <div className="p-6 space-y-10">
      {classes.created.length > 0 && <ClassesSection title="Created Classes" classes={classes.created} />}
      {classes.teaching.length > 0 && <ClassesSection title="Teaching Classes" classes={classes.teaching} />}
      {classes.enrolled.length > 0 && <ClassesSection title="Enrolled Classes" classes={classes.enrolled} />}
      {classes.created.length === 0 && classes.teaching.length === 0 && classes.enrolled.length === 0 && (
        <p>No classes found.</p>
      )}
    </div>
  );
}
