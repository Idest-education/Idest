"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { UserProfile } from "@/types/user";
import { getCurrentUser } from "@/services/user.service";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Lấy user khi component mount
    supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        try {
          const p = await getCurrentUser();
          setProfile(p);
        } catch {
          // Ignore profile fetch errors for navbar
        }
      }
    });

    // Theo dõi thay đổi đăng nhập/đăng xuất
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        getCurrentUser()
          .then(setProfile)
          .catch(() => {
            setProfile(null);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">Đăng nhập</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link href="/auth/sign-up">Đăng ký</Link>
        </Button>
      </div>
    );
  }

  const avatarUrl = profile?.avatarUrl
    || (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.avatarUrl))
    || null;
  const displayName = profile?.fullName || user.user_metadata?.full_name || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-gray-200 px-2 py-1 hover:bg-gray-50 transition-colors">
          <div className="relative h-8 w-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName || "Hồ sơ"}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <span>{displayName?.charAt(0)?.toUpperCase() ?? "U"}</span>
            )}
          </div>
          <span className="hidden sm:inline text-sm text-gray-800 max-w-[160px] truncate">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <span className="text-xs text-gray-500 truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
          Hồ sơ của tôi
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings/password")}>
          Đổi mật khẩu
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
