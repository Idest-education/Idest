"use client";

import { useEffect, useState } from "react";
import { getAllSubmissions } from "@/services/assignment.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import LoadingScreen from "@/components/loading-screen";

type Skill = "reading" | "listening" | "writing" | "speaking";

export default function AdminSubmissionsPage() {
  const [activeSkill, setActiveSkill] = useState<Skill | "all">("all");
  const [submissions, setSubmissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getAllSubmissions(activeSkill === "all" ? undefined : activeSkill);
      setSubmissions(data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [activeSkill]);

  if (loading && !submissions) return <LoadingScreen />;

  const submissionsList = Array.isArray(submissions) ? submissions : submissions?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Submissions Management</h1>
        <p className="text-gray-600 mt-2">View all submissions across skills</p>
      </div>

      <Tabs value={activeSkill} onValueChange={(v) => setActiveSkill(v as Skill | "all")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="reading">Reading</TabsTrigger>
          <TabsTrigger value="listening">Listening</TabsTrigger>
          <TabsTrigger value="writing">Writing</TabsTrigger>
          <TabsTrigger value="speaking">Speaking</TabsTrigger>
        </TabsList>

        <TabsContent value={activeSkill}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeSkill === "all" ? "All" : activeSkill.charAt(0).toUpperCase() + activeSkill.slice(1)} Submissions
                {submissionsList.length > 0 && ` (${submissionsList.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissionsList.length > 0 ? (
                <div className="space-y-2">
                  {submissionsList.map((submission: any, index: number) => (
                    <div key={submission.id || index} className="p-4 border rounded hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Assignment: {submission.assignment_id || "N/A"}
                          </div>
                          <div className="text-sm text-gray-500">
                            User: {submission.user_id || submission.submitted_by || "N/A"}
                          </div>
                          {submission.score !== undefined && (
                            <Badge className="mt-2">Score: {submission.score}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {submission.created_at
                            ? new Date(submission.created_at).toLocaleString()
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No submissions found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

