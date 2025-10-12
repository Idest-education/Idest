"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { joinClass } from "@/services/class.service";
import { toast } from "sonner";
import { LogIn, Key, Users, Sparkles } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface JoinClassModalProps {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

export default function JoinClassModal({ open, onClose, onJoined }: JoinClassModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code.");
      return;
    }
    setLoading(true);
    const res = await joinClass(inviteCode.trim());
    setLoading(false);

    if (res.status) {
      toast.success(res.message);
      onJoined?.();
      onClose();
      setInviteCode("");
    } else {
      toast.error(res.message || "Failed to join class");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-to-br from-blue-50 via-white to-indigo-50 [&>button:last-child]:hidden">
        <DialogClose asChild>
          <button className="absolute right-4 top-4 rounded-full p-2 text-gray-600 hover:text-white hover:bg-indigo-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <DialogHeader className="space-y-3 pb-4 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Join a Class
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Enter the invite code to join
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">


          {/* Input section */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                Invite Code
              </Label>
              <Input
                id="invite-code"
                placeholder="Enter your invite code (e.g., IELTS2025)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoin();
                }}
                className="border-indigo-600 focus:indigo-600 focus:indigo-600 text-gray-900 font-mono text-base h-12"
                autoFocus
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                💡 Get the code from your teacher or class administrator
              </p>
            </div>

            <Button
              onClick={handleJoin}
              disabled={loading || !inviteCode.trim()}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-base font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Joining...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Join Class
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}