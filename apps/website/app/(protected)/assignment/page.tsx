"use client";

import { useEffect, useState } from "react";
import AssignmentCard from "@/components/assignment/assignment-card";
import { getAssignments } from "@/services/assignment.service";
import type { AssignmentResponse } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getAssignments();
      setAssignments(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading)
    return <LoadingScreen />;
  if (!assignments) return <p className="p-6">No assignments</p>;

  const groups = [
    { key: "reading", title: "Reading Assignments" },
    { key: "listening", title: "Listening Assignments" },
    { key: "writing", title: "Writing Assignments" },
    { key: "speaking", title: "Speaking Assignments" },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <h1 className="text-3xl font-semibold mb-6">Assignments</h1>

      {groups.map((g) => {
        const list = (assignments as any)[g.key] as any[];

        if (!list || list.length === 0) return null;

        return (
          <div key={g.key} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{g.title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {list.map((item) => (
                <AssignmentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

