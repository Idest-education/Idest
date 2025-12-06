"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CheckoutCancelPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const classId = searchParams.get("classId");
  const className = searchParams.get("className");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-orange-100 p-3">
              <XCircle className="w-12 h-12 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-900">
            Payment Cancelled
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800 text-center">
              Your payment was cancelled. No charges were made.
            </p>
          </div>

          {className && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Class Name</p>
              <p className="font-semibold text-gray-900">{className}</p>
            </div>
          )}

          <p className="text-gray-600 text-center text-sm">
            You can complete your purchase anytime by returning to the class
            page.
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
            {classId && (
              <Link href={`/classes/${classId}`} className="flex-1">
                <Button className="w-full">Try Again</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

