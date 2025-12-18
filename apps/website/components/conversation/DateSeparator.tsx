"use client";

import { getDateSeparator } from "@/lib/utils/date-format";

interface DateSeparatorProps {
  date: Date | string;
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="flex items-center gap-3 w-full max-w-md">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-medium text-gray-500 px-3 py-1 bg-gray-50 rounded-full">
          {getDateSeparator(date)}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  );
}




