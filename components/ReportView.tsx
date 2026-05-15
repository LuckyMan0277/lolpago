"use client";

import { useState } from "react";
import {
  ChevronDown,
  Zap,
  Target,
  Clock,
  Swords,
  Ban,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OPERATION_LABEL, type OperationValue } from "@/lib/schema";
import type { ReportOutput } from "@/lib/schema";
import { GEO_LANE_LABEL } from "@/lib/champions";
import { cn } from "@/lib/utils";
import { LanePriorityTimeline } from "@/components/LanePriorityTimeline";

export function ReportView({ report }: { report: ReportOutput }) {
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <KeyOrders orders={report.key_orders} />
      <WinFormulas
        us={report.win_formulas.us}
        them={report.win_formulas.them}
        operation={report.team_operation}
      />
      <FightConditions
        when={report.fight_conditions.when}
        avoid={report.fight_conditions.avoid}
      />
      <KeyTriggers triggers={report.key_triggers} />
      {report.lane_priority_timeline && (
        <LanePriorityTimeline
          laneTimeline={report.lane_priority_timeline}
          teamTimeline={report.team_priority_timeline}
        />
      )}
      <MyRole guide={report.my_champion_guide} />
      <FirstFive firstFive={report.first_5_min} />
      <PhaseStrip summary={report.summary} />
      {report.jungle_path && <JungleInfo jp={report.jungle_path} />}
    </div>
  );
}

// ============== 한 줄 오더 ==============
function KeyOrders({ orders }: { orders: string[] }) {
  return (
    <Card className="border-primary/50 bg-primary/10">
      <CardContent className="py-5">
        <div className="text-[10px] uppercase tracking-wider text-primary/80 mb-2.5 font-semibold">
          이번 판 오더
        </div>
        <ol className="space-y-2.5">
          {orders.map((o, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-primary font-bold text-lg w-5 shrink-0 tabular-nums">
                {i + 1}
              </span>
              <span className="text-base sm:text-lg font-bold leading-snug">
                {o}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ============== 승리 공식 ==============
function WinFormulas({
  us,
  them,
  operation,
}: {
  us: string;
  them: string;
  operation: ReportOutput["team_operation"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <FormulaBox
        side="us"
        formula={us}
        main={operation.our_main}
        sub={operation.our_sub}
        style={operation.our_style}
        strengths={operation.our_strengths}
      />
      <FormulaBox
        side="enemy"
        formula={them}
        main={operation.enemy_main}
        sub={operation.enemy_sub}
        style={operation.enemy_style}
        strengths={operation.enemy_strengths}
      />
    </div>
  );
}

function FormulaBox({
  side,
  formula,
  main,
  sub,
  style,
  strengths,
}: {
  side: "us" | "enemy";
  formula: string;
  main: OperationValue;
  sub: OperationValue | null;
  style: string;
  strengths: string[];
}) {
  const isUs = side === "us";
  return (
    <Card
      className={cn(
        isUs
          ? "border-sky-500/40 bg-gradient-to-b from-sky-500/10 to-sky-500/[0.02]"
          : "border-rose-500/40 bg-gradient-to-b from-rose-500/10 to-rose-500/[0.02]",
      )}
    >
      <CardContent className="py-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          {isUs ? (
            <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />
          )}
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider font-semibold",
              isUs ? "text-sky-300" : "text-rose-300",
            )}
          >
            {isUs ? "우리 승리 공식" : "상대 승리 공식"}
          </span>
        </div>
        <p className="text-sm font-medium leading-snug">{formula}</p>
        <div className="flex flex-wrap gap-1 items-center pt-1">
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-bold",
              isUs
                ? "bg-sky-500/20 text-sky-200"
                : "bg-rose-500/20 text-rose-200",
            )}
          >
            {OPERATION_LABEL[main]}
          </span>
          {sub && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                isUs
                  ? "bg-sky-500/10 text-sky-300/80"
                  : "bg-rose-500/10 text-rose-300/80",
              )}
            >
              +{OPERATION_LABEL[sub]}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground leading-snug">
          {style}
        </div>
        <div className="flex flex-wrap gap-1">
          {strengths.map((s, i) => (
            <span
              key={i}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                isUs
                  ? "bg-sky-500/10 text-sky-300/90"
                  : "bg-rose-500/10 text-rose-300/90",
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== 핵심 팀 트리거 ==============
function KeyTriggers({
  triggers,
}: {
  triggers: ReportOutput["key_triggers"];
}) {
  return (
    <Card className="border-violet-500/40 bg-violet-500/8">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300 font-semibold">
          <Target className="h-3 w-3" />
          핵심 팀 트리거
        </div>
        <ol className="space-y-2.5">
          {triggers.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/25 text-violet-200 text-[11px] font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm font-semibold leading-snug">
                  <span className="text-violet-300">{t.champion}</span>
                  <span className="text-muted-foreground mx-1.5 text-xs">·</span>
                  {t.when}
                </div>
                <div className="flex gap-1.5 leading-snug text-sm">
                  <span className="text-violet-400 shrink-0 font-bold">→</span>
                  <span>{t.team_does}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ============== 내 챔피언 ==============
function MyRole({ guide }: { guide: ReportOutput["my_champion_guide"] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-4">
        <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5 font-semibold flex items-center gap-1.5">
          <Zap className="h-3 w-3" />내 챔피언
        </div>
        <p className="font-semibold text-sm sm:text-base leading-snug">
          {guide.role_this_game}
        </p>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          />
          {open ? "접기" : "초반/중반/한타 플랜"}
        </button>
        {open && (
          <div className="mt-2 pt-2.5 border-t border-amber-500/20 space-y-1.5 text-xs fade-in">
            <DetailRow label="초반" value={guide.early_plan} />
            <DetailRow label="중반" value={guide.mid_plan} />
            <DetailRow label="한타" value={guide.teamfight_role} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 leading-snug">
      <span className="shrink-0 w-8 text-[11px] text-amber-400/80">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

// ============== 교전 조건 (승리 공식 바로 아래) ==============
function FightConditions({
  when,
  avoid,
}: {
  when: string;
  avoid: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-3.5">
          <div className="flex items-start gap-2.5">
            <Swords className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                싸울 때
              </div>
              <p className="text-sm leading-snug">{when}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardContent className="py-3.5">
          <div className="flex items-start gap-2.5">
            <Ban className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold">
                피할 때
              </div>
              <p className="text-sm leading-snug">{avoid}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== 첫 5분 ==============
function FirstFive({ firstFive }: { firstFive: string }) {
  return (
    <Card>
      <CardContent className="py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30 mt-0.5">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
              첫 5분
            </div>
            <p className="text-sm leading-snug">{firstFive}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============== 페이즈 스트립 ==============
const PHASE_STYLE: Record<
  "GOOD" | "EVEN" | "BAD",
  { bg: string; text: string; label: string }
> = {
  GOOD: {
    bg: "bg-emerald-500/15 border-emerald-500/40",
    text: "text-emerald-300",
    label: "유리",
  },
  EVEN: {
    bg: "bg-amber-500/15 border-amber-500/40",
    text: "text-amber-300",
    label: "균형",
  },
  BAD: {
    bg: "bg-rose-500/15 border-rose-500/40",
    text: "text-rose-300",
    label: "불리",
  },
};

function PhaseStrip({ summary }: { summary: ReportOutput["summary"] }) {
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          <PhaseBox label="초반" phase={summary.early_phase} />
          <PhaseBox label="중반" phase={summary.mid_phase} />
          <PhaseBox label="후반" phase={summary.late_phase} />
        </div>
        <p className="text-sm leading-snug">{summary.headline}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2 leading-snug">
            <span className="text-emerald-400 font-semibold">승리 조건 </span>
            <span>{summary.win_condition}</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-2 leading-snug">
            <span className="text-rose-400 font-semibold">핵심 위험 </span>
            <span>{summary.key_risk}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseBox({
  label,
  phase,
}: {
  label: string;
  phase: "GOOD" | "EVEN" | "BAD";
}) {
  const s = PHASE_STYLE[phase];
  return (
    <div className={cn("border rounded-md px-2 py-2.5 text-center", s.bg, s.text)}>
      <div className="text-[10px] opacity-70">{label}</div>
      <div className="font-bold text-sm sm:text-base mt-0.5">{s.label}</div>
    </div>
  );
}

// ============== 정글 정보 (정글일 때만) ==============
function JungleInfo({ jp }: { jp: NonNullable<ReportOutput["jungle_path"]> }) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="py-4 space-y-2.5">
        <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
          내 정글 정보
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill
            label="클리어"
            value={
              { FAST: "빠름", NORMAL: "보통", SLOW: "느림" }[jp.clear_speed]
            }
          />
          <Pill
            label="플랜"
            value={
              {
                "3CAMP": "3캠프",
                "4CAMP": "4캠프",
                FULL_CLEAR: "풀캠프",
              }[jp.plan]
            }
          />
          <Pill label="파워창" value={jp.power_window} accent />
          <Pill
            label="첫 갱"
            value={jp.first_gank_priority
              .map((l) => GEO_LANE_LABEL[l])
              .join(" > ")}
          />
        </div>
        <div className="text-[11px] text-rose-300/90 leading-snug flex gap-1.5 pt-1">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-rose-400" />
          <span>{jp.enemy_jungler_warning}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs",
        accent
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-muted/40 border-border text-foreground/80",
      )}
    >
      <span className="text-[10px] opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
