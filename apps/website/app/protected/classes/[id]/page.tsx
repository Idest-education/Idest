"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassById } from "@/services/class.service";
import { ClassDetail } from "@/types/class";

export default function ClassDetailPage() {
  const { id } = useParams(); // Lấy id từ URL
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getClassById(id as string)
      .then((res) => setClassData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (!classData) return <p className="p-6">Class not found.</p>;

  return (
    <div className="p-6 space-y-4 text-black">
      <h1 className="text-2xl font-bold">{classData.name}</h1>
      <p className="text-gray-600">{classData.description}</p>

      <div>
        <h2 className="text-lg font-semibold">Schedule</h2>
        <p>
          {classData.schedule.days.join(", ")} at {classData.schedule.time} (
          {classData.schedule.duration} mins)
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Creator</h2>
        <p>
          {classData.creator.full_name} ({classData.creator.role})
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Stats</h2>
        <p>Members: {classData._count.members}</p>
        <p>Teachers: {classData._count.teachers}</p>
        <p>Sessions: {classData._count.sessions}</p>
      </div>
    </div>
  );
}
