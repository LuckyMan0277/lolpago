"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GEO_LANE_LABEL, type GeoLane } from "@/lib/champions";
import type { ReportOutput } from "@/lib/schema";
import { cn } from "@/lib/utils";

type LaneTimeline = NonNullable<ReportOutput["lane_priority_timeline"]>;
type TeamTimeline = NonNullable<ReportOutput["team_priority_timeline"]>;

const valueAt = (
  points: Array<{ t: number; value: number }>,
  t: number,
): number => {
  if (points.length === 0) return 0;
  if (t <= points[0].t) return points[0].value;
  if (t >= points[points.length - 1].t)
    return points[points.length - 1].value;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].t <= t && t < points[i + 1].t) {
      const ratio = (t - points[i].t) / (points[i + 1].t - points[i].t);
      return points[i].value + (points[i + 1].value - points[i].value) * ratio;
    }
  }
  return 0;
};

const FPS_MS = 60;
const PLAY_STEP_PER_TICK = 0.2;
const T_MIN = 3;
const T_MAX = 25;
const ORDER: GeoLane[] = ["TOP", "JUNGLE", "MID", "BOTTOM"];

export function LanePriorityTimeline({
  laneTimeline,
  teamTimeline,
}: {
  laneTimeline: LaneTimeline;
  teamTimeline?: TeamTimeline;
}) {
  const [time, setTime] = useState(T_MIN);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime((t) => {
        const next = t + PLAY_STEP_PER_TICK;
        return next > T_MAX ? T_MIN : next;
      });
    }, FPS_MS);
    return () => clearInterval(id);
  }, [playing]);

  const sortedLanes = [...laneTimeline].sort(
    (a, b) => ORDER.indexOf(a.lane) - ORDER.indexOf(b.lane),
  );

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
            주도권 시계열
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums font-mono text-primary">
              {formatTime(time)}
            </span>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted hover:bg-muted/70 text-foreground/80"
              aria-label={playing ? "일시정지" : "재생"}
            >
              {playing ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {/* 팀 전체 시계열 (강조) */}
        {teamTimeline && (
          <Row
            kind="team"
            label="팀"
            value={valueAt(teamTimeline, time)}
            emphasized
          />
        )}

        {teamTimeline && <div className="h-px bg-border/50 -mx-1" />}

        {/* 라인별 시계열 */}
        <div className="space-y-2">
          {sortedLanes.map((row) => (
            <Row
              kind="lane"
              key={row.lane}
              label={GEO_LANE_LABEL[row.lane]}
              value={valueAt(row.points, time)}
            />
          ))}
        </div>

        <div className="space-y-1.5 pt-1">
          <input
            type="range"
            min={T_MIN}
            max={T_MAX}
            step={0.1}
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(Number(e.target.value));
            }}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60 tabular-nums px-0.5">
            <span>3분</span>
            <span>10분</span>
            <span>17분</span>
            <span>25분</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  kind,
  label,
  value,
  emphasized,
}: {
  kind: "team" | "lane";
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  // value: -1 (full 우리) ~ +1 (full 적)
  const pos = ((value + 1) / 2) * 100;
  const intensity = Math.abs(value);
  const baseSize = emphasized ? 14 : 10;
  const sizeRange = emphasized ? 18 : 14;
  const size = baseSize + intensity * sizeRange;
  const isUs = value < 0;
  const alpha = 0.35 + intensity * 0.65;
  const ringAlpha = 0.15 + intensity * 0.45;

  const dotColor = isUs
    ? `rgba(96, 165, 250, ${alpha})` // blue-400
    : `rgba(251, 113, 133, ${alpha})`; // rose-400
  const ringColor = isUs
    ? `rgba(96, 165, 250, ${ringAlpha})`
    : `rgba(251, 113, 133, ${ringAlpha})`;

  const trackHeight = emphasized ? "h-9" : "h-7";

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-10 text-[11px] shrink-0 font-medium",
          emphasized
            ? "text-foreground flex items-center gap-1"
            : "text-muted-foreground",
        )}
      >
        {emphasized && <Users className="h-3 w-3 text-primary" />}
        {label}
      </div>
      <span className="text-[10px] text-sky-300/70 shrink-0 w-7 text-right tabular-nums">
        우리
      </span>
      <div className={cn("flex-1 relative", trackHeight)}>
        <div
          className={cn(
            "absolute top-1/2 left-0 right-0 -translate-y-1/2 rounded-full",
            emphasized
              ? "h-1.5 bg-gradient-to-r from-sky-500/20 via-muted/60 to-rose-500/20"
              : "h-1 bg-gradient-to-r from-sky-500/15 via-muted to-rose-500/15",
          )}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30" />
        <div
          className="absolute top-1/2 rounded-full"
          style={{
            left: `${pos}%`,
            width: `${size}px`,
            height: `${size}px`,
            transform: "translate(-50%, -50%)",
            backgroundColor: dotColor,
            boxShadow: `0 0 0 ${4 + intensity * 8}px ${ringColor}`,
            transition: "left 80ms linear, width 80ms linear, height 80ms linear",
          }}
        />
      </div>
      <span className="text-[10px] text-rose-300/70 shrink-0 w-7 tabular-nums">
        상대
      </span>
    </div>
  );
}

function formatTime(t: number): string {
  const m = Math.floor(t);
  const s = Math.round((t - m) * 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
