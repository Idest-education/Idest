"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SessionActionsProps {
  sessionId: string;
  isActive: boolean;
  onEnd: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}

export default function SessionActions({
  sessionId,
  isActive,
  onEnd,
  onDelete,
}: SessionActionsProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEnd = async () => {
    setLoading(true);
    try {
      await onEnd(sessionId);
      setShowEndDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(sessionId);
      setShowDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {isActive && (
          <Button
            onClick={() => setShowEndDialog(true)}
            variant="outline"
            size="sm"
          >
            End Session
          </Button>
        )}
        <Button
          onClick={() => setShowDeleteDialog(true)}
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Delete
        </Button>
      </div>

      {/* End Session Confirmation Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to end this session? This will set the end
              time to now and mark the session as completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleEnd} disabled={loading}>
              {loading ? "Ending..." : "End Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

