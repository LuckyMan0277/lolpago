import championsJson from "@/data/champions.json";
import knowledgeJson from "@/data/champion-knowledge.json";

export type Champion = {
  id: number;
  key: string;
  name_en: string;
  name_ko: string;
  title_ko: string;
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
  partype: string;
};

export const PATCH = championsJson.patch;
export const CHAMPIONS = championsJson.champions as Champion[];

const byKey = new Map(CHAMPIONS.map((c) => [c.key, c]));
const byId = new Map(CHAMPIONS.map((c) => [c.id, c]));

export const getChampionByKey = (key: string) => byKey.get(key);
export const getChampionById = (id: number) => byId.get(id);

export const championImageUrl = (key: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${PATCH}/img/champion/${key}.png`;

// 챔피언 공식 정보 (Data Dragon ko_KR 기반) + Claude 생성 강점/약점/파워커브.
export type ChampionKnowledge = {
  name: string;
  title: string;
  tags: string[];
  info: string;
  resource: string;
  passive: string;
  Q: string;
  W: string;
  E: string;
  R: string;
  // ↓ Claude로 생성. 일부 챔피언은 아직 비어있을 수 있음 (optional).
  identity?: string;
  power?: { early: number; mid: number; late: number };
  power_window?: string;
  damage_type?: "AP" | "AD" | "MIXED" | "TRUE";
  powerspikes?: string[];
  strengths?: string[];
  weaknesses?: string[];
};

const KNOWLEDGE = knowledgeJson as unknown as Record<
  string,
  ChampionKnowledge | string
>;

export const getChampionKnowledge = (key: string): ChampionKnowledge | null => {
  if (key.startsWith("_")) return null;
  const v = KNOWLEDGE[key];
  if (!v || typeof v === "string") return null;
  return v;
};

export const hasChampionKnowledge = (key: string) =>
  getChampionKnowledge(key) !== null;

// 입력 폼/플레이어 포지션 (5개)
export const LANES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
export type Lane = (typeof LANES)[number];

export const LANE_LABEL: Record<Lane, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MID: "미드",
  ADC: "원딜",
  SUPPORT: "서폿",
};

// 라인 분석/정글 갱 우선순위에 쓰는 지리적 라인 (4개, 바텀은 ADC+서폿 듀오로 묶임)
export const GEO_LANES = ["TOP", "JUNGLE", "MID", "BOTTOM"] as const;
export type GeoLane = (typeof GEO_LANES)[number];

export const GEO_LANE_LABEL: Record<GeoLane, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MID: "미드",
  BOTTOM: "바텀",
};
