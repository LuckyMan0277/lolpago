// 라인별 시간 주도권 곡선을 챔피언 power 데이터에서 결정론적으로 계산.
// value: -1 (완전 우리 우세) ~ +1 (완전 상대 우세)

import { getChampionKnowledge } from "@/lib/champions";
import type { GeoLaneValue } from "@/lib/schema";

export type TimelinePoint = { t: number; value: number };
export type LanePriorityTimeline = Array<{
  lane: GeoLaneValue;
  points: TimelinePoint[];
}>;

// 시간 샘플 (분). 8개 → 부드러운 애니메이션
const TIME_POINTS = [3, 6, 9, 12, 15, 18, 21, 25];

// 게임 시간 t(분) → 챔피언 power(early/mid/late 1~5)에서 보간된 강도
// early: 0~7분, mid: 7~17분, late: 17분+
const interpolatePower = (
  power: { early: number; mid: number; late: number } | undefined,
  t: number,
): number => {
  if (!power) return 3; // 기본값(보통)
  if (t <= 7) return power.early;
  if (t <= 17) {
    const ratio = (t - 7) / 10;
    return power.early + (power.mid - power.early) * ratio + (power.late - power.early) * 0;
    // 잘못된 공식. 다시.
  }
  return power.late;
};

// 더 정확한 보간: early→mid→late 3단계
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const powerAt = (
  power: { early: number; mid: number; late: number } | undefined,
  t: number,
): number => {
  if (!power) return 3;
  if (t <= 5) return power.early;
  if (t <= 12) return lerp(power.early, power.mid, (t - 5) / 7); // 5~12분
  if (t <= 20) return lerp(power.mid, power.late, (t - 12) / 8); // 12~20분
  return power.late;
};

const avgPower = (
  champKeys: string[],
  t: number,
): number => {
  if (champKeys.length === 0) return 3;
  let sum = 0;
  for (const k of champKeys) {
    const knowledge = getChampionKnowledge(k);
    sum += powerAt(knowledge?.power, t);
  }
  return sum / champKeys.length;
};

// 한 라인의 시간별 주도권 계산
const computeLaneCurve = (
  ourLaneChamps: string[],
  enemyLaneChamps: string[],
): TimelinePoint[] => {
  return TIME_POINTS.map((t) => {
    const ourP = avgPower(ourLaneChamps, t);
    const enemyP = avgPower(enemyLaneChamps, t);
    // power 차이 -4~+4 범위. enemy가 강하면 양수.
    const diff = enemyP - ourP;
    // -1~+1로 정규화 + 클립
    const value = Math.max(-1, Math.min(1, diff / 3));
    return { t, value: Number(value.toFixed(3)) };
  });
};

type Pick = { championKey: string; lane: string };

// 우리/적 픽에서 라인별로 챔피언 분리. lane은 입력용 5포지션 enum.
const collectByGeoLane = (picks: Pick[]): Record<GeoLaneValue, string[]> => {
  const out: Record<GeoLaneValue, string[]> = {
    TOP: [],
    JUNGLE: [],
    MID: [],
    BOTTOM: [],
  };
  for (const p of picks) {
    if (p.lane === "TOP") out.TOP.push(p.championKey);
    else if (p.lane === "JUNGLE") out.JUNGLE.push(p.championKey);
    else if (p.lane === "MID") out.MID.push(p.championKey);
    else if (p.lane === "ADC" || p.lane === "SUPPORT")
      out.BOTTOM.push(p.championKey);
  }
  return out;
};

export const computeLanePriorityTimeline = (
  ourPicks: Pick[],
  enemyPicks: Pick[],
): LanePriorityTimeline => {
  const ours = collectByGeoLane(ourPicks);
  const enemies = collectByGeoLane(enemyPicks);
  const geoLanes: GeoLaneValue[] = ["TOP", "JUNGLE", "MID", "BOTTOM"];
  return geoLanes.map((lane) => ({
    lane,
    points: computeLaneCurve(ours[lane], enemies[lane]),
  }));
};

// 팀 전체 5명 시계열 (라인 무관)
export const computeTeamPriorityTimeline = (
  ourPicks: Pick[],
  enemyPicks: Pick[],
): TimelinePoint[] => {
  const ourKeys = ourPicks.map((p) => p.championKey);
  const enemyKeys = enemyPicks.map((p) => p.championKey);
  return TIME_POINTS.map((t) => {
    const ourP = avgPower(ourKeys, t);
    const enemyP = avgPower(enemyKeys, t);
    const diff = enemyP - ourP;
    const value = Math.max(-1, Math.min(1, diff / 3));
    return { t, value: Number(value.toFixed(3)) };
  });
};

export { TIME_POINTS };
