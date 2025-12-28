"use client";

import { useEffect, useState } from "react";
import { getAllSubmissions } from "@/services/assignment.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import Link from "next/link";

type Skill = "reading" | "listening" | "writing" | "speaking";

export default function AdminSubmissionsPage() {
  const [activeSkill, setActiveSkill] = useState<Skill>("reading");
  const [submissions, setSubmissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getAllSubmissions(activeSkill);
      setSubmissions(data);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      setSubmissions(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [activeSkill]);

  if (loading && !submissions) return <LoadingScreen />;

  // Handle different response formats
  let submissionsList: any[] = [];
  if (Array.isArray(submissions)) {
    submissionsList = submissions;
  } else if (submissions && typeof submissions === 'object') {
    if (Array.isArray(submissions.data)) {
      submissionsList = submissions.data;
    } else if (submissions.status && submissions.data) {
      // Backend wrapped response
      const data = submissions.data;
      submissionsList = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    }
  }

  // Filter by search query
  const filteredSubmissions = searchQuery.trim()
    ? submissionsList.filter((sub: any) => {
      const query = searchQuery.toLowerCase();
      return (
        (sub.assignment_id && sub.assignment_id.toLowerCase().includes(query)) ||
        (sub.user_id && sub.user_id.toLowerCase().includes(query)) ||
        (sub.submitted_by && sub.submitted_by.toLowerCase().includes(query)) ||
        (sub.assignmentTitle && sub.assignmentTitle.toLowerCase().includes(query))
      );
    })
    : submissionsList;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Submissions Management</h1>
        <p className="text-gray-600 mt-2">View and manage all assignment submissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by assignment ID, user ID, or assignment title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeSkill} onValueChange={(v) => setActiveSkill(v as Skill)}>
        <TabsList>
          <TabsTrigger value="reading">Reading</TabsTrigger>
          <TabsTrigger value="listening">Listening</TabsTrigger>
          <TabsTrigger value="writing">Writing</TabsTrigger>
          <TabsTrigger value="speaking">Speaking</TabsTrigger>
        </TabsList>

        <TabsContent value={activeSkill}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeSkill.charAt(0).toUpperCase() + activeSkill.slice(1)} Submissions
                {filteredSubmissions.length > 0 && ` (${filteredSubmissions.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSubmissions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Assignment</th>
                        <th className="text-left p-3">User</th>
                        <th className="text-left p-3">Skill</th>
                        <th className="text-left p-3">Score</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Submitted</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((submission: any, index: number) => (
                        <tr key={submission.id || submission.submissionId || index} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium">
                              {submission.assignmentTitle || submission.assignment_id || "N/A"}
                            </div>
                            {submission.assignmentId && (
                              <div className="text-sm text-gray-500">{submission.assignmentId}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="text-sm">
                              {submission.user_id || submission.submitted_by || submission.userId || "N/A"}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {submission.skill || activeSkill}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {submission.score !== undefined && submission.score !== null ? (
                              <Badge>{submission.score}</Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                submission.status === "graded"
                                  ? "default"
                                  : submission.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {submission.status || "pending"}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {submission.created_at || submission.createdAt
                              ? (() => {
                                try {
                                  const date = new Date(submission.created_at || submission.createdAt);
                                  return isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
                                } catch {
                                  return "N/A";
                                }
                              })()
                              : "N/A"}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              {submission.submissionId && (
                                <Link href={`/assignment/${submission.skill || activeSkill}/${submission.assignmentId || submission.assignment_id}?submission=${submission.submissionId}`}>
                                  <Button variant="outline" size="sm">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

