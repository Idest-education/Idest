"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Video, Mic, MicOff, VideoOff, CircleDot, MoreVertical, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetStore } from "@/hooks/useMeetStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface MeetParticipantsPanelProps {
  kickParticipant: (userId: string) => void;
  stopParticipantMedia: (userId: string, mediaType: 'audio' | 'video' | 'both') => void;
}

export function MeetParticipantsPanel({
  kickParticipant,
  stopParticipantMedia,
}: MeetParticipantsPanelProps) {
  const participantsObject = useMeetStore((state) => state.participants);
  const localUserId = useMeetStore((state) => state.localUserId);
  const allParticipants = useMemo(() => Object.values(participantsObject), [participantsObject]);
  const [showAbsents, setShowAbsents] = useState(false);

  const onlineParticipants = useMemo(
    () => allParticipants.filter((p) => p.isOnline),
    [allParticipants],
  );
  const offlineParticipants = useMemo(
    () => allParticipants.filter((p) => !p.isOnline),
    [allParticipants],
  );

  const displayedParticipants = showAbsents ? allParticipants : onlineParticipants;
  const allJoined = offlineParticipants.length === 0 && onlineParticipants.length > 0;

  const localParticipant = localUserId ? participantsObject[localUserId] : null;
  const canManageParticipants = localParticipant?.role === 'admin' || localParticipant?.role === 'teacher';

  const canManageTarget = (targetRole: string) => {
    if (!localParticipant) return false;
    if (localParticipant.role === 'admin') return true;
    if (localParticipant.role === 'teacher') return targetRole === 'student';
    return false;
  };

  const handleKick = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to remove ${userName} from the session?`)) {
      kickParticipant(userId);
    }
  };

  const handleStopMedia = (userId: string, mediaType: 'audio' | 'video' | 'both') => {
    stopParticipantMedia(userId, mediaType);
  };

  const renderParticipantItem = (participant: any, isOffline: boolean = false) => {
    const isSelf = localUserId === participant.userId;
    const canManage = !isSelf && canManageParticipants && canManageTarget(participant.role);

    const content = (
      <div className={`flex items-center justify-between rounded-lg border border-border/40 p-3 ${isOffline ? 'opacity-60' : ''} ${canManage ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {participant.userAvatar ? (
            <Image
              src={participant.userAvatar}
              alt={participant.userFullName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover flex-shrink-0"
              unoptimized
            />
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
              {participant.userFullName.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{participant.userFullName} {isSelf && "(You)"}</p>
            <p className="text-xs text-muted-foreground capitalize">{participant.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 text-muted-foreground mr-1">
            {participant.isAudioEnabled ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5 text-destructive" />
            )}
            {participant.isVideoEnabled ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <VideoOff className="h-3.5 w-3.5 text-destructive" />
            )}
            <CircleDot
              className={`h-3 w-3 ${
                participant.isOnline ? "text-green-500" : "text-muted-foreground"
              }`}
            />
          </div>
          {canManage && !isOffline && (
             <MoreVertical className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
      </div>
    );

    if (canManage && !isOffline) {
      return (
        <DropdownMenu key={participant.userId}>
          <DropdownMenuTrigger asChild>
            <div className="w-full outline-none">
              {content}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Manage {participant.userFullName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStopMedia(participant.userId, 'audio')}>
              <MicOff className="mr-2 h-4 w-4" />
              <span>Mute Audio</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStopMedia(participant.userId, 'video')}>
              <VideoOff className="mr-2 h-4 w-4" />
              <span>Stop Video</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleKick(participant.userId, participant.userFullName)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Remove from Session</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return <div key={participant.userId}>{content}</div>;
  };

  return (
    <div className="flex h-full w-full sm:w-72 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm">
      <div className="flex-shrink-0 border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            Participants ({displayedParticipants.length})
          </div>
          {offlineParticipants.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAbsents(!showAbsents)}
              className="h-7 text-xs"
            >
              {showAbsents ? "Ẩn người vắng mặt" : "Hiển thị người vắng mặt"}
            </Button>
          )}
        </div>
        {allJoined && (
          <p className="mt-1 text-xs text-green-600 font-medium">Tất cả đã tham gia!</p>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {showAbsents && onlineParticipants.length > 0 && offlineParticipants.length > 0 ? (
          <>
            {/* Online participants */}
            {onlineParticipants.map((participant) => renderParticipantItem(participant))}

            {/* Separator */}
            <div className="my-3 flex items-center gap-2">
              <div className="flex-1 border-t border-border/40"></div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Vắng mặt</span>
              <div className="flex-1 border-t border-border/40"></div>
            </div>

            {/* Offline participants */}
            {offlineParticipants.map((participant) => renderParticipantItem(participant, true))}
          </>
        ) : (
          // No separator needed - show all participants normally
          displayedParticipants.map((participant) => renderParticipantItem(participant))
        )}

        {displayedParticipants.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {showAbsents ? "Chưa có người tham gia nào." : "Không có người tham gia trực tuyến."}
          </p>
        )}
      </div>
    </div>
  );
}
