"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassData } from "@/types/class";

export default function ClassCard({ cls }: { cls: ClassData }) {
  const router = useRouter();

  return (
    <Card
      key={cls.id}
      className="shadow-md hover:shadow-lg transition cursor-pointer"
      onClick={() => router.push(`/protected/classes/${cls.id}`)}
    >
      <CardHeader>
        <CardTitle>{cls.name}</CardTitle>
        <CardDescription>{cls.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Invite: {cls.invite_code}</Badge>
          <Badge>{cls.schedule.time} ({cls.schedule.timezone})</Badge>
        </div>
        <p>
          <strong>Days:</strong> {cls.schedule.days.join(", ")}
        </p>
        <p>
          <strong>Members:</strong> {cls._count.members} | Sessions: {cls._count.sessions}
        </p>
      </CardContent>
    </Card>
  );
}
