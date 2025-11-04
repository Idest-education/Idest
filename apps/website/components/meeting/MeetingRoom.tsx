"use client";

import { useState, useEffect, useMemo } from "react";
import { useMeeting } from "@/hooks/use-meeting";
import VideoGrid from "./VideoGrid";
import MeetingControls from "./MeetingControls";
import MeetingChat from "./MeetingChat";
import ParticipantList from "./ParticipantList";
import LoadingScreen from "@/components/loading-screen";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingRoomProps {
  sessionId: string;
  token: string;
}

export default function MeetingRoom({ sessionId, token }: MeetingRoomProps) {
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [isMediaInitializing, setIsMediaInitializing] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const {
    isConnected,
    isJoining,
    error,
    localStream,
    localScreenShareStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    participants,
    localParticipant,
    messages,
    messageHistory,
    remoteStreams,
    remoteScreenShareStreams,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    loadMessageHistory,
  } = useMeeting();

  const debugState = useMemo(() => {
    const summarizeStream = (stream: MediaStream | null) => {
      if (!stream) return null;
      return {
        id: stream.id,
        tracks: stream.getTracks().map((t) => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          label: t.label,
        })),
      };
    };
    return {
      isConnected,
      isJoining,
      error,
      isAudioEnabled,
      isVideoEnabled,
      isScreenSharing,
      sessionId,
      participants,
      localParticipant,
      messagesCount: messages.length,
      messageHistoryCount: messageHistory.length,
      localStream: summarizeStream(localStream),
      localScreenShareStream: summarizeStream(localScreenShareStream),
      remoteStreams: Array.from(remoteStreams.entries()).map(([userId, stream]) => ({
        userId,
        stream: summarizeStream(stream),
      })),
      remoteScreenShareStreams: Array.from(remoteScreenShareStreams.entries()).map(([userId, stream]) => ({
        userId,
        stream: summarizeStream(stream),
      })),
    };
  }, [
    isConnected,
    isJoining,
    error,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    sessionId,
    participants,
    localParticipant,
    messages,
    messageHistory,
    localStream,
    localScreenShareStream,
    remoteStreams,
    remoteScreenShareStreams,
  ]);

  // Join room on mount - only run once per sessionId/token change
  useEffect(() => {
    let isMounted = true;
    
    if (isMounted) {
      joinRoom(sessionId, token);
    }

    return () => {
      isMounted = false;
      leaveRoom(sessionId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]); // Only depend on sessionId and token, not the functions

  // Load message history on join
  useEffect(() => {
    if (isConnected) {
      loadMessageHistory(sessionId, 50);
    }
  }, [isConnected, sessionId, loadMessageHistory]);

  // Track media initialization
  useEffect(() => {
    if (localStream) {
      setIsMediaInitializing(false);
    }
  }, [localStream]);

  // Track unread messages when chat is hidden
  useEffect(() => {
    const currentMessageCount = messages.length + messageHistory.length;
    
    if (!showChat && currentMessageCount > lastMessageCount) {
      // Increase unread count when new messages arrive while chat is hidden
      const newMessages = currentMessageCount - lastMessageCount;
      setUnreadMessageCount((prev) => prev + newMessages);
    }
    
    setLastMessageCount(currentMessageCount);
  }, [messages, messageHistory, showChat, lastMessageCount]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessageCount(0);
    }
  }, [showChat]);

  // Handle leave and navigation
  const handleLeave = () => {
    leaveRoom(sessionId);
    window.location.href = "/sessions";
  };

  if (isJoining || isMediaInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingScreen />
          <p className="mt-4 text-gray-600">
            {isJoining ? "Joining meeting..." : "Initializing camera and microphone..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAccessDenied = error.toLowerCase().includes("access denied") || 
                          error.toLowerCase().includes("denied");
    
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {isAccessDenied ? "Access Denied" : "Failed to join meeting"}
          </h2>
          <p className="text-gray-600 mb-2">{error}</p>
          {isAccessDenied && (
            <p className="text-sm text-gray-500 mb-6">
              You may not be enrolled in this class or the session may have restrictions.
            </p>
          )}
          <button
            onClick={handleLeave}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Go Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Debug Toggle */}
      <div className="absolute top-3 right-3 z-50">
        <Button variant="secondary" size="sm" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? "Hide Debug" : "Show Debug"}
        </Button>
      </div>

      {showDebug && (
        <div className="fixed bottom-3 right-3 z-50 w-[520px] max-h-[60vh] bg-white border border-gray-200 rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700">Meeting Debug State</div>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>Close</Button>
          </div>
          <div className="overflow-auto max-h-[50vh]">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">
{JSON.stringify(debugState, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid - main area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <VideoGrid
              localParticipant={localParticipant}
              localStream={localStream}
              localScreenShareStream={localScreenShareStream}
              isLocalAudioEnabled={isAudioEnabled}
              isLocalVideoEnabled={isVideoEnabled}
              isLocalScreenSharing={isScreenSharing}
              participants={participants}
              remoteStreams={remoteStreams}
              remoteScreenShareStreams={remoteScreenShareStreams}
            />
          </div>

          {/* Controls */}
          <div className="flex-shrink-0">
          <MeetingControls
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            isScreenSharing={isScreenSharing}
            showChat={showChat}
            showParticipants={showParticipants}
            onToggleChat={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
            onToggleParticipants={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
            newMessageCount={unreadMessageCount}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onLeave={handleLeave}
          />
          </div>
        </div>

        {/* Sidebar - Chat and Participants */}
        <div className="flex gap-0 border-l border-gray-200">
          {/* Chat */}
          {showChat && (
            <div className="w-80">
              <MeetingChat
                messages={messages}
                messageHistory={messageHistory}
                onSendMessage={(message) => sendMessage(sessionId, message)}
                sessionId={sessionId}
              />
            </div>
          )}

          {/* Participants */}
          {showParticipants && (
            <div className="w-64">
              <ParticipantList
                participants={participants}
                localParticipant={localParticipant}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

