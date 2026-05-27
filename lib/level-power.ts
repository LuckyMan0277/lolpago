// 챔피언별 라인 적합도 + 레벨 스파이크 / 라인전 강도 데이터.
// - JUNGLE: 3렙 정글 강도(level_spike). 3캠프 후 갱/카정 압박.
// - TOP/MID/BOTTOM: 2렙 라인 강도(level_spike) + 라인전 종합 강도(laning).
//
// 데이터 채우기: `node scripts/generate-level-power.mjs`
// 스케일: 1=매우 약함, 5=매우 강함.

import levelPowerJson from "@/data/level-power-rankings.json";

export const LANE_ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM"] as const;
export type LaneRole = (typeof LANE_ROLES)[number];

export type LaneScore = {
  level_spike: number; // JUNGLE: 3렙, 그 외: 2렙. 1~5.
  laning?: number; // TOP/MID/BOTTOM 만. 1~5. JUNGLE은 undefined.
};

export type ChampionLevelPower = {
  roles: LaneRole[];
  by_lane: Partial<Record<LaneRole, LaneScore>>;
};

const RAW = levelPowerJson as unknown as Record<
  string,
  ChampionLevelPower | string | null
>;

export const getLevelPower = (key: string): ChampionLevelPower | null => {
  if (key.startsWith("_")) return null;
  const v = RAW[key];
  if (!v || typeof v === "string") return null;
  if (!Array.isArray(v.roles) || !v.by_lane) return null;
  return v;
};

export const getLaneScore = (
  key: string,
  lane: LaneRole,
): LaneScore | null => {
  const entry = getLevelPower(key);
  if (!entry) return null;
  return entry.by_lane[lane] ?? null;
};

export const hasLevelPower = (key: string) => getLevelPower(key) !== null;
