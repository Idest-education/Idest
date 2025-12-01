"use client";

import { Button } from "@/components/ui/button";
import { Video, PencilRuler } from "lucide-react";
import { useMeetStore } from "@/hooks/useMeetStore";
import { cn } from "@/lib/utils";

type TabType = 'video' | 'canvas';

interface MeetCanvasTabProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function MeetCanvasTab({ activeTab, onTabChange }: MeetCanvasTabProps) {
  const isCanvasActive = useMeetStore((state) => state.isCanvasActive);
  const activeCanvasUser = useMeetStore((state) => state.activeCanvasUser);
  const participants = useMeetStore((state) => state.participants);

  const activeTeacherName = activeCanvasUser 
    ? participants[activeCanvasUser]?.userFullName || 'Teacher'
    : null;

  return (
    <div className="flex-shrink-0 border-b border-border/40 bg-background">
      <div className="flex items-center gap-1 px-4 py-2">
        <Button
          variant={activeTab === 'video' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onTabChange('video')}
          className={cn(
            "rounded-b-none",
            activeTab === 'video' && "border-b-2 border-b-primary"
          )}
        >
          <Video className="h-4 w-4" />
          <span className="ml-2">Video</span>
        </Button>
        
        <Button
          variant={activeTab === 'canvas' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onTabChange('canvas')}
          disabled={!isCanvasActive}
          className={cn(
            "rounded-b-none relative",
            activeTab === 'canvas' && "border-b-2 border-b-primary",
            !isCanvasActive && "opacity-50 cursor-not-allowed"
          )}
          title={!isCanvasActive ? 'Canvas is not active' : undefined}
        >
          <PencilRuler className="h-4 w-4" />
          <span className="ml-2">Canvas</span>
          {isCanvasActive && (
            <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </Button>

        {isCanvasActive && activeTeacherName && (
          <div className="ml-auto text-xs text-muted-foreground">
            Canvas: {activeTeacherName}
          </div>
        )}
      </div>
    </div>
  );
}


