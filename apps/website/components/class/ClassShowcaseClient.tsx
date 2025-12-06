"use client";

import { useEffect, useMemo, useState } from "react";
import { ClassData, ClassResponse } from "@/types/class";
import { getUserClasses, getAllVisibleClasses } from "@/services/class.service";
import { createClassCheckoutSession } from "@/services/stripe.service";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  Users,
  Crown,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatVnd(price?: number | null, currency?: string) {
  if (price == null) return "Free";
  const formatter = new Intl.NumberFormat("vi-VN");
  const cur = (currency || "VND").toUpperCase();
  return `${formatter.format(price)} ${cur}`;
}

export default function ClassShowcaseClient() {
  const [userClasses, setUserClasses] = useState<ClassResponse>({
    created: [],
    teaching: [],
    enrolled: [],
  });
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const enrolledIds = useMemo(() => {
    const set = new Set<string>();
    userClasses.created.forEach((c) => set.add(c.id));
    userClasses.teaching.forEach((c) => set.add(c.id));
    userClasses.enrolled.forEach((c) => set.add(c.id));
    return set;
  }, [userClasses]);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, all] = await Promise.all([
          getUserClasses(),
          getAllVisibleClasses(),
        ]);
        setUserClasses(
          userRes?.data || { created: [], teaching: [], enrolled: [] },
        );
        setAllClasses(all || []);
      } catch (e) {
        console.error("Failed to load classes for showcase", e);
        setError("Failed to load classes. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);


  const openModal = (cls: ClassData) => {
    setSelectedId(cls.id);
    setModalOpen(true);
    setSelectedClass(cls);
    setError(null);
    setSuccessMessage(null);
  };

  const refreshUserClasses = async () => {
    try {
      const userRes = await getUserClasses();
      setUserClasses(
        userRes?.data || { created: [], teaching: [], enrolled: [] },
      );
    } catch (e) {
      console.error("Failed to refresh user classes", e);
    }
  };

  const handlePurchase = async () => {
    if (!selectedId) return;
    setPurchaseLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const session = await createClassCheckoutSession(selectedId);

      // Log the response for debugging (remove in production if needed)
      console.log("Checkout session response:", session);

      // Handle free classes
      if (session.isFree) {
        // Free class - already enrolled by backend
        await refreshUserClasses();
        setSuccessMessage("You have been enrolled in this class.");
        setPurchaseLoading(false);
        return;
      }

      // Handle already owned classes
      if (session.alreadyOwned) {
        await refreshUserClasses();
        setSuccessMessage("You already own this class.");
        setPurchaseLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (session.url) {
        window.location.href = session.url;
        // Note: setPurchaseLoading won't be called here since we're redirecting
      } else {
        // Log the full response for debugging
        console.error("Checkout session response missing URL:", session);
        throw new Error(
          "No checkout URL received from server. The payment session may not have been created properly. Please try again or contact support."
        );
      }
    } catch (e) {
      console.error("Purchase failed", e);
      const errorMessage = e instanceof Error ? e.message : "Purchase failed. Please try again.";
      setError(errorMessage);
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
          <p className="text-gray-600 text-sm">Loading classes for you...</p>
        </div>
      </div>
    );
  }

  const hasClasses = allClasses.length > 0;

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      {/* Global success/error message banner */}
      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ×
          </button>
        </div>
      )}
      {error && !successMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
      {/* Header strip */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 via-pink-100 to-indigo-100 text-xs font-medium text-gray-800 shadow-sm mb-4">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Curated English classes just for you
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Discover your next{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              breakthrough class
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl">
            Hand-picked IELTS and English classes with live sessions, expert
            teachers, and AI-powered practice. Enroll in a class that matches
            your goals and level.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs md:text-sm">
            <Crown className="w-4 h-4 text-amber-300" />
            <span>Premium experiences</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs md:text-sm border border-emerald-100">
            <ShieldCheck className="w-4 h-4" />
            <span>Safe & secure payments</span>
          </div>
        </div>
      </div>

      {!hasClasses ? (
        <div className="border border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white via-gray-50 to-gray-100">
          <div className="max-w-md mx-auto space-y-4">
            <BookOpen className="w-10 h-10 mx-auto text-gray-400" />
            <h3 className="text-2xl font-semibold text-gray-900">
              No classes available yet
            </h3>
            <p className="text-gray-600">
              Check back soon for new classes, or ask your teacher to invite you
              to a private class.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {allClasses.map((cls) => {
            const isEnrolled = enrolledIds.has(cls.id);
            const isGroup = (cls as any).is_group ?? true;
            return (
              <Card
                key={cls.id}
                className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-900/90 text-white cursor-pointer hover:-translate-y-1 hover:shadow-2xl transition-all duration-200"
                onClick={() => openModal(cls)}
              >
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#6366f1,_transparent_55%),_radial-gradient(circle_at_bottom,_#ec4899,_transparent_55%)]" />
                <div className="relative p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-2">
                      <CardTitle className="text-lg font-semibold leading-tight">
                        {cls.name}
                      </CardTitle>
                      <p className="text-xs text-gray-300 line-clamp-2">
                        {cls.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={isEnrolled ? "secondary" : "outline"}
                        className={
                          isEnrolled
                            ? "bg-emerald-400 text-emerald-900 border-transparent"
                            : "border-gray-500 text-gray-100"
                        }
                      >
                        {isEnrolled ? "Enrolled" : isGroup ? "Group class" : "1:1"}
                      </Badge>
                      <span className="text-xs text-gray-300">
                        {cls._count?.members ?? 0} learners
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wide text-gray-300">
                        Starting from
                      </div>
                      <div className="text-lg font-semibold">
                        {formatVnd(cls.price, cls.currency)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white hover:text-gray-900 bg-white/10 backdrop-blur-sm"
                    >
                      {isEnrolled ? (
                        <>
                          Go to class
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      ) : (
                        <>
                          View details
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-white text-gray-900 max-h-[80vh] overflow-y-auto sm:max-w-5xl">
          {selectedClass ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{selectedClass.name}</span>
                  <Badge className="bg-gray-900 text-white border-transparent">
                    {formatVnd(selectedClass.price, selectedClass.currency)}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Taught by {selectedClass.creator.full_name} •{" "}
                  {selectedClass._count.members} learners enrolled
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-[1.7fr,1.3fr] gap-8 mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">About this class</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {selectedClass.description}
                  </p>

                  <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Highlights
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5" />
                        <span>
                          Live interactive sessions designed to boost your confidence
                          in real exam scenarios.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="w-4 h-4 text-pink-500 mt-0.5" />
                        <span>
                          Collaborative practice with peers plus 1:1 guidance from
                          experienced instructors.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-500 mt-0.5" />
                        <span>
                          Homework, assignments, and AI-powered feedback to refine
                          your skills between sessions.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 p-5 bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-900 text-white shadow-lg">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-gray-300">
                      Investment
                    </div>
                    <div className="text-3xl font-bold">
                      {formatVnd(selectedClass.price, selectedClass.currency)}
                    </div>
                    <p className="text-xs text-gray-300">
                      One-time purchase for full access to this class.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Button
                      className="w-full bg-emerald-400 hover:bg-emerald-300 text-gray-900 font-semibold flex items-center justify-center gap-2"
                      onClick={handlePurchase}
                      disabled={purchaseLoading}
                    >
                      {purchaseLoading ? (
                        <>
                          Processing...
                          <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                        </>
                      ) : (
                        <>
                          Purchase &amp; Enroll
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-gray-300 text-center">
                      Secure payment powered by Stripe. Access is granted
                      immediately after purchase.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-200 mt-2">
                    <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                      <div className="font-semibold mb-1">Live sessions</div>
                      <div>{selectedClass._count.sessions}+ included</div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                      <div className="font-semibold mb-1">Level</div>
                      <div>Intermediate – Advanced</div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-3 text-xs text-red-200 bg-red-500/20 border border-red-500/40 rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}
                  {successMessage && (
                    <div className="mt-3 text-xs text-emerald-200 bg-emerald-500/20 border border-emerald-500/40 rounded-md px-3 py-2">
                      {successMessage}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Loading class…</DialogTitle>
                <DialogDescription>
                  Fetching class details, please wait.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                  <p className="text-gray-600 text-sm">
                    Loading class details...
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}


