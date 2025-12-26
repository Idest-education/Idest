"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSessionById,
  getSessionAttendance,
  endSession,
  deleteSession,
} from "@/services/session.service";
import {
  listSessionRecordings,
  getRecordingUrl,
  startRecording,
  stopRecording,
} from "@/services/meet.service";
import { SessionData, SessionAttendanceSummaryDto } from "@/types/session";
import { MeetRecordingListItem } from "@/services/meet.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Square, Trash2, Play, Square as StopIcon, Video } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { CopyButton } from "@/components/copy-button";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const [session, setSession] = useState<SessionData | null>(null);
  const [attendance, setAttendance] = useState<SessionAttendanceSummaryDto | null>(null);
  const [recordings, setRecordings] = useState<MeetRecordingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionRes, attendanceRes, recordingsRes] = (await Promise.all([
          getSessionById(sessionId),
          getSessionAttendance(sessionId),
          listSessionRecordings(sessionId).catch(() => ({ sessionId, items: [] })),
        ])) as [SessionData, SessionAttendanceSummaryDto, { sessionId: string; items: MeetRecordingListItem[] }];
        // Responses are now unwrapped, so use directly
        setSession(sessionRes);
        setAttendance(attendanceRes);
        setRecordings(recordingsRes.items || []);
      } catch (error) {
        console.error("Error fetching session data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  const handleEndSession = async () => {
    if (!confirm("Are you sure you want to end this session?")) return;
    try {
      await endSession(sessionId);
      const updated = (await getSessionById(sessionId)) as SessionData;
      // Response is now unwrapped
      setSession(updated);
    } catch (error) {
      console.error("Error ending session:", error);
      alert("Failed to end session");
    }
  };

  const handleDeleteSession = async () => {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return;
    try {
      await deleteSession(sessionId);
      router.push("/admin/sessions");
    } catch (error) {
      console.error("Error deleting session:", error);
      alert("Failed to delete session");
    }
  };

  const handleStartRecording = async () => {
    try {
      await startRecording(sessionId);
      const updated = await listSessionRecordings(sessionId);
      setRecordings(updated.items || []);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to start recording, " + error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording(sessionId);
      const updated = await listSessionRecordings(sessionId);
      setRecordings(updated.items || []);
    } catch (error) {
      console.error("Error stopping recording:", error);
      alert("Failed to stop recording");
    }
  };

  const handleGetRecordingUrl = async (recordingId: string) => {
    try {
      const result = await getRecordingUrl(recordingId);
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        alert("Recording URL not available yet");
      }
    } catch (error) {
      console.error("Error getting recording URL:", error);
      alert("Failed to get recording URL");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!session) return <div>Session not found</div>;

  const isActive = !session.end_time;
  const activeRecording = recordings.find(r => r.recordingId && !r.stoppedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Session Details</h1>
          <p className="text-gray-600 mt-2">{session.class.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Class</div>
              <div className="font-medium">{session.class.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Host</div>
              <div>
                <div className="font-medium">{session.host.full_name}</div>
                <div className="text-sm text-gray-500">{session.host.email}</div>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Start Time</div>
              <div>{new Date(session.start_time).toLocaleString()}</div>
            </div>
            {session.end_time && (
              <div>
                <div className="text-sm text-gray-500">End Time</div>
                <div>{new Date(session.end_time).toLocaleString()}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Active" : "Ended"}
              </Badge>
            </div>
            <div className="flex gap-2 pt-4">
              {isActive && (
                <Button variant="outline" onClick={handleEndSession}>
                  <Square className="w-4 h-4 mr-2" />
                  End Session
                </Button>
              )}
              <Button variant="destructive" onClick={handleDeleteSession}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Session
              </Button>
            </div>
          </CardContent>
        </Card>

        {attendance && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Total Attendees</div>
                <div className="text-2xl font-bold">{attendance.total_attendees}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Active Attendees</div>
                <div className="text-2xl font-bold">{attendance.active_attendees}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Attended Count</div>
                <div className="text-2xl font-bold">{attendance.attended_count}</div>
              </div>
              {attendance.attendees.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Attendees</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {attendance.attendees.map((attendee) => (
                      <div key={attendee.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{attendee.user?.full_name || "Unknown"}</div>
                          <div className="text-sm text-gray-500">
                            {attendee.joined_at ? new Date(attendee.joined_at).toLocaleTimeString() : "N/A"}
                          </div>
                        </div>
                        <Badge variant={attendee.is_attended ? "default" : "outline"}>
                          {attendee.is_attended ? "Attended" : "Not Attended"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recordings</CardTitle>
            {isActive && (
              <div className="flex gap-2">
                {activeRecording ? (
                  <Button variant="outline" onClick={handleStopRecording}>
                    <StopIcon className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                ) : (
                  <Button onClick={handleStartRecording}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recordings.length > 0 ? (
            <div className="space-y-2">
              {recordings.map((recording, index) => (
                <div key={recording.recordingId || index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">
                      Recording {index + 1}
                      {recording.recordingId && (
                        <Badge variant="outline" className="ml-2">
                          {recording.recordingId.substring(0, 8)}...
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {recording.startedAt && `Started: ${new Date(recording.startedAt).toLocaleString()}`}
                      {recording.stoppedAt && ` | Stopped: ${new Date(recording.stoppedAt).toLocaleString()}`}
                    </div>
                    {!recording.url && recording.recordingId && (
                      <div className="mt-2 text-xs text-gray-500">
                        <div>If server is down, contact admin with this id to get recording:</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono">{recording.recordingId}</span>
                          <CopyButton text={recording.recordingId} label="recording id" />
                          {recording.egressId && (
                            <CopyButton text={recording.egressId} label="egress id" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {recording.recordingId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGetRecordingUrl(recording.recordingId!)}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      View Recording
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">No recordings available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

