"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = [
  { at: 0, text: "조합 분석 중" },
  { at: 8, text: "라인별 매치업 평가 중" },
  { at: 20, text: "정글 동선 설계 중" },
  { at: 32, text: "상대법과 운영 플랜 작성 중" },
  { at: 45, text: "한 줄 오더 다듬는 중" },
  { at: 60, text: "거의 다 됐어요" },
];

const EXPECTED_SEC = 55;

export function LoadingReport() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, []);

  const currentStep = [...STEPS].reverse().find((s) => elapsed >= s.at)!;
  const pct = Math.min(96, Math.floor((elapsed / EXPECTED_SEC) * 100));

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card overflow-hidden">
        <CardContent className="pt-5 pb-5 space-y-3.5">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={2.2} />
              <span className="absolute inset-0 rounded-lg bg-primary/20 animate-ping opacity-40" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">
                {currentStep.text}
                <span className="ml-0.5 inline-block animate-pulse">...</span>
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {elapsed}초 / 예상 {EXPECTED_SEC}초
              </div>
            </div>
          </div>
          <div className="relative h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-white/20 w-12 blur-sm animate-[shimmer_1.8s_ease-in-out_infinite]"
              style={{ left: `${Math.max(0, pct - 8)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {[...Array(4)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-5 pb-5 space-y-2.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
          </CardContent>
        </Card>
      ))}

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(20px);
          }
        }
      `}</style>
    </div>
  );
}
