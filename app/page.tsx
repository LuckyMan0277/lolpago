"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  RotateCcw,
  Download,
  Loader2,
  ArrowRight,
  Trophy,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChampionPicker } from "@/components/ChampionPicker";
import { ReportView } from "@/components/ReportView";
import { LoadingReport } from "@/components/LoadingReport";
import { ErrorCard } from "@/components/ErrorCard";
import {
  CHAMPIONS,
  LANES,
  LANE_LABEL,
  PATCH,
  championImageUrl,
  type Champion,
  type Lane,
} from "@/lib/champions";
import type { ReportOutput } from "@/lib/schema";
import { cn } from "@/lib/utils";

const championByKey = new Map(CHAMPIONS.map((c) => [c.key, c]));

type Team = (Champion | null)[];
type TeamKey = "BLUE" | "RED";
type SlotKey = { team: TeamKey; laneIdx: number };
type MyPick = { team: TeamKey; laneIndex: number } | null;

const TIERS = [
  { value: "IRON_BRONZE", label: "아이언-브론즈" },
  { value: "SILVER_GOLD", label: "실버-골드" },
  { value: "PLAT_EMERALD", label: "플래티넘-에메랄드" },
  { value: "DIAMOND", label: "다이아몬드" },
  { value: "MASTER_PLUS", label: "마스터+" },
] as const;

type TierValue = (typeof TIERS)[number]["value"];

const emptyTeam = (): Team => [null, null, null, null, null];
const slotId = (s: SlotKey) => `${s.team}-${s.laneIdx}`;

export default function HomePage() {
  const [blue, setBlue] = useState<Team>(emptyTeam);
  const [red, setRed] = useState<Team>(emptyTeam);
  const [my, setMy] = useState<MyPick>(null);
  const [tier, setTier] = useState<TierValue>("PLAT_EMERALD");

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [riotId, setRiotId] = useState("");
  const [loadingGame, setLoadingGame] = useState(false);
  const [loadGameMsg, setLoadGameMsg] = useState<string | null>(null);
  const [loadGameError, setLoadGameError] = useState<string | null>(null);

  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("lolpago.riotId")
        : null;
    if (saved) setRiotId(saved);
  }, []);

  const getChampAt = (s: SlotKey): Champion | null =>
    s.team === "BLUE" ? blue[s.laneIdx] : red[s.laneIdx];

  const loadCurrentGame = async () => {
    const trimmed = riotId.trim();
    if (!trimmed) return;
    setLoadingGame(true);
    setLoadGameError(null);
    setLoadGameMsg(null);
    try {
      const res = await fetch("/api/load-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotId: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "불러오기 실패");
      }
      localStorage.setItem("lolpago.riotId", trimmed);

      const fillTeam = (
        picks: Array<{ championKey: string; lane: Lane }>,
      ): Team => {
        const slots: Team = emptyTeam();
        for (const p of picks) {
          const idx = LANES.indexOf(p.lane);
          if (idx >= 0) {
            slots[idx] = championByKey.get(p.championKey) ?? null;
          }
        }
        return slots;
      };

      setBlue(fillTeam(data.myTeam));
      setRed(fillTeam(data.enemyTeam));

      if (data.myLane) {
        const laneIdx = LANES.indexOf(data.myLane as Lane);
        if (laneIdx >= 0) {
          setMy({ team: "BLUE", laneIndex: laneIdx });
        }
      }
      setLoadGameMsg(
        `${data.gameName}#${data.tagLine} 게임 불러왔습니다 (라인이 어긋나면 챔피언을 끌어 옮기세요)`,
      );
    } catch (e) {
      setLoadGameError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingGame(false);
    }
  };

  const allKeys = [...blue.filter(Boolean), ...red.filter(Boolean)].map(
    (c) => (c as Champion).key,
  );

  const canSubmit =
    blue.every((c) => c !== null) &&
    red.every((c) => c !== null) &&
    my !== null;

  const updateSlot = (team: TeamKey, laneIdx: number, champ: Champion) => {
    if (team === "BLUE") {
      setBlue((prev) => prev.map((c, i) => (i === laneIdx ? champ : c)));
    } else {
      setRed((prev) => prev.map((c, i) => (i === laneIdx ? champ : c)));
    }
  };

  const reset = () => {
    setBlue(emptyTeam());
    setRed(emptyTeam());
    setMy(null);
    setReport(null);
    setError(null);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as SlotKey | undefined;
    if (data) setActiveSlot(data);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveSlot(null);
    const from = e.active.data.current as SlotKey | undefined;
    const to = e.over?.data.current as SlotKey | undefined;
    if (!from || !to) return;
    if (from.team === to.team && from.laneIdx === to.laneIdx) return;

    const newBlue = [...blue];
    const newRed = [...red];
    const getC = (s: SlotKey) =>
      s.team === "BLUE" ? newBlue[s.laneIdx] : newRed[s.laneIdx];
    const setC = (s: SlotKey, c: Champion | null) => {
      if (s.team === "BLUE") newBlue[s.laneIdx] = c;
      else newRed[s.laneIdx] = c;
    };
    const fromC = getC(from);
    const toC = getC(to);
    setC(from, toC);
    setC(to, fromC);
    setBlue(newBlue);
    setRed(newRed);

    if (my) {
      const sameTeam = from.team === to.team;
      if (my.team === from.team && my.laneIndex === from.laneIdx) {
        if (sameTeam) setMy({ team: to.team, laneIndex: to.laneIdx });
        else setMy(null);
      } else if (my.team === to.team && my.laneIndex === to.laneIdx) {
        if (sameTeam) setMy({ team: from.team, laneIndex: from.laneIdx });
        else setMy(null);
      }
    }
  };

  const submit = async () => {
    if (!canSubmit || !my) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const myTeamArr = my.team === "BLUE" ? blue : red;
      const body = {
        patch: PATCH,
        tier,
        teamBlue: blue.map((c, i) => ({
          championKey: (c as Champion).key,
          lane: LANES[i],
        })),
        teamRed: red.map((c, i) => ({
          championKey: (c as Champion).key,
          lane: LANES[i],
        })),
        myPick: {
          championKey: (myTeamArr[my.laneIndex] as Champion).key,
          lane: LANES[my.laneIndex],
        },
      };
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "리포트 생성 실패");
      }
      setReport(data.report as ReportOutput);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6">
        <LoadingReport />
      </main>
    );
  }

  if (report) {
    return (
      <main className="container mx-auto px-4 py-6 sm:py-8 space-y-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono tabular-nums">
              {PATCH}
            </span>
            <span>·</span>
            <span>{TIERS.find((t) => t.value === tier)?.label}</span>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            새 리포트
          </Button>
        </div>
        <ReportView report={report} />
      </main>
    );
  }

  const activeChamp = activeSlot ? getChampAt(activeSlot) : null;
  const activeLane = activeSlot ? LANES[activeSlot.laneIdx] : null;

  return (
    <main className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          새 리포트 만들기
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          10명 챔피언과 내 챔피언만 정해주면 끝.
        </p>
      </div>

      <div className="space-y-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                <Download className="h-3 w-3" />
              </span>
              현재 게임 자동 불러오기
              <span className="text-[11px] text-muted-foreground font-normal ml-auto">
                로딩 화면부터
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-1">
            <div className="flex gap-2">
              <Input
                placeholder="소환사명#KR1"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loadingGame) loadCurrentGame();
                }}
                disabled={loadingGame}
                className="flex-1 h-10"
              />
              <Button
                variant="secondary"
                onClick={loadCurrentGame}
                disabled={loadingGame || !riotId.trim()}
                className="shrink-0 h-10 px-4"
              >
                {loadingGame ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "불러오기"
                )}
              </Button>
            </div>
            {loadGameMsg && (
              <p className="text-xs text-emerald-400 leading-snug">
                {loadGameMsg}
              </p>
            )}
            {loadGameError && (
              <p className="text-xs text-rose-400 leading-snug">
                {loadGameError}
              </p>
            )}
          </CardContent>
        </Card>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveSlot(null)}
        >
          <TeamPanel
            title="우리 팀"
            accent="blue"
            team={blue}
            excludeKeys={allKeys}
            my={my}
            teamKey="BLUE"
            activeSlot={activeSlot}
            onChange={(idx, c) => updateSlot("BLUE", idx, c)}
            onPickMe={(idx) =>
              setMy(
                my?.team === "BLUE" && my.laneIndex === idx
                  ? null
                  : { team: "BLUE", laneIndex: idx },
              )
            }
          />
          <TeamPanel
            title="상대 팀"
            accent="red"
            team={red}
            excludeKeys={allKeys}
            my={my}
            teamKey="RED"
            activeSlot={activeSlot}
            onChange={(idx, c) => updateSlot("RED", idx, c)}
            onPickMe={(idx) =>
              setMy(
                my?.team === "RED" && my.laneIndex === idx
                  ? null
                  : { team: "RED", laneIndex: idx },
              )
            }
          />

          <DragOverlay dropAnimation={null}>
            {activeChamp && activeLane ? (
              <div className="flex items-center gap-2.5 pl-2 pr-3.5 py-2 bg-card border-2 border-primary rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.35)] rotate-[1.5deg] pointer-events-none">
                <Image
                  src={championImageUrl(activeChamp.key)}
                  alt={activeChamp.name_ko}
                  width={40}
                  height={40}
                  className="rounded-md shrink-0 ring-1 ring-primary/40"
                  unoptimized
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
                    {LANE_LABEL[activeLane]}
                  </span>
                  <span className="font-bold text-sm">
                    {activeChamp.name_ko}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <Card>
          <CardContent className="py-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <Trophy className="h-3 w-3" strokeWidth={2.2} />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
                티어 구간
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((t) => {
                const selected = tier === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTier(t.value)}
                    className={cn(
                      "px-3 h-8 rounded-full text-xs font-medium transition-all border",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                        : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {error && (
          <ErrorCard
            title="리포트 생성 실패"
            detail={error}
            onRetry={() => setError(null)}
          />
        )}

        <Button
          size="lg"
          className={cn(
            "w-full h-12 text-base font-semibold",
            canSubmit && "cta-glow",
          )}
          disabled={!canSubmit}
          onClick={submit}
        >
          {canSubmit ? (
            <>
              리포트 생성
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          ) : my === null ? (
            "내 챔피언에 ⭐ 표시하기"
          ) : (
            "10명 모두 선택하기"
          )}
        </Button>

        <div className="pt-4 flex flex-col items-center gap-2 text-[11px] text-muted-foreground/70">
          <Link
            href="/about"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            이 서비스가 뭔가요?
            <ArrowRight className="h-3 w-3" />
          </Link>
          <span className="text-muted-foreground/50">
            Riot Games is not affiliated with this site.
          </span>
        </div>
      </div>
    </main>
  );
}

function TeamPanel({
  title,
  accent,
  team,
  excludeKeys,
  my,
  teamKey,
  activeSlot,
  onChange,
  onPickMe,
}: {
  title: string;
  accent: "blue" | "red";
  team: Team;
  excludeKeys: string[];
  my: MyPick;
  teamKey: TeamKey;
  activeSlot: SlotKey | null;
  onChange: (laneIdx: number, c: Champion) => void;
  onPickMe: (laneIdx: number) => void;
}) {
  const filled = team.filter(Boolean).length;
  const isUs = accent === "blue";
  const accentRing = isUs ? "border-sky-500/40" : "border-rose-500/30";
  const accentBg = isUs
    ? "bg-gradient-to-b from-sky-500/8 to-transparent"
    : "bg-gradient-to-b from-rose-500/8 to-transparent";
  const accentDot = isUs ? "bg-sky-400" : "bg-rose-400";
  const accentText = isUs ? "text-sky-300" : "text-rose-300";
  return (
    <Card className={cn(accentRing, accentBg)}>
      <CardHeader className="pb-2">
        <CardTitle
          className={cn(
            "text-sm flex items-center gap-2 font-semibold",
            accentText,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", accentDot)} />
          {title}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
            {filled} / 5
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {LANES.map((lane: Lane, i) => {
          const isMine = my?.team === teamKey && my.laneIndex === i;
          const slot: SlotKey = { team: teamKey, laneIdx: i };
          const isActive =
            activeSlot?.team === teamKey && activeSlot.laneIdx === i;
          return (
            <SlotRow key={lane} slot={slot} isActive={isActive}>
              <div className="w-10 text-[11px] font-medium text-muted-foreground shrink-0 select-none">
                {LANE_LABEL[lane]}
              </div>
              <DraggableArea slot={slot} disabled={!team[i]}>
                <ChampionPicker
                  value={team[i]}
                  onChange={(c) => onChange(i, c)}
                  excludeKeys={excludeKeys.filter((k) => k !== team[i]?.key)}
                />
              </DraggableArea>
              <Button
                variant={isMine ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "shrink-0 h-10 w-10 transition-colors",
                  !isMine && "text-muted-foreground/40 hover:text-amber-400",
                )}
                onClick={() => onPickMe(i)}
                aria-label="내 챔피언으로 지정"
                title="내 챔피언으로 지정"
              >
                <Star
                  className={cn(
                    "h-4 w-4 transition-all",
                    isMine && "fill-current text-primary-foreground",
                  )}
                />
              </Button>
            </SlotRow>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SlotRow({
  slot,
  isActive,
  children,
}: {
  slot: SlotKey;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${slotId(slot)}`,
    data: slot,
  });
  const isTarget = isOver && !isActive;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md px-1 py-0.5 -mx-1",
        "transition-[background-color,box-shadow,transform] duration-150",
        isTarget &&
          "bg-primary/20 ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.01]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 w-full transition-opacity",
          isActive && "opacity-25",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function DraggableArea({
  slot,
  disabled,
  children,
}: {
  slot: SlotKey;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `drag-${slotId(slot)}`,
    data: slot,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex-1 min-w-0 touch-none rounded-md",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      {children}
    </div>
  );
}
