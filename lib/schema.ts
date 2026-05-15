import { z } from "zod";
import { LANES, GEO_LANES } from "@/lib/champions";

export const LaneEnum = z.enum(LANES);
export type LaneValue = z.infer<typeof LaneEnum>;

export const GeoLaneEnum = z.enum(GEO_LANES);
export type GeoLaneValue = z.infer<typeof GeoLaneEnum>;

// ---- 팀 운영 유형 (8가지) ----
export const OPERATION_TYPES = [
  "SPLIT_PUSH",      // 스플릿 운영
  "TEAMFIGHT",       // 5:5 한타
  "PICK_OFF",        // 픽/잘라먹기
  "POKE_SIEGE",      // 포킹/시즈
  "DIVE_SNOWBALL",   // 다이브·스노우볼
  "LATE_SCALING",    // 후반 밸류
  "GLOBAL_PRESSURE", // 글로벌
  "COUNTER_ENGAGE",  // 카운터 이니시
] as const;

export const OperationEnum = z.enum(OPERATION_TYPES);
export type OperationValue = z.infer<typeof OperationEnum>;

export const OPERATION_LABEL: Record<OperationValue, string> = {
  SPLIT_PUSH: "스플릿 운영",
  TEAMFIGHT: "5:5 한타",
  PICK_OFF: "픽/잘라먹기",
  POKE_SIEGE: "포킹/시즈",
  DIVE_SNOWBALL: "다이브·스노우볼",
  LATE_SCALING: "후반 밸류",
  GLOBAL_PRESSURE: "글로벌 운영",
  COUNTER_ENGAGE: "카운터 이니시",
};

// ---- 입력 스키마 ----
export const ChampionPickSchema = z.object({
  championKey: z.string().min(1),
  lane: LaneEnum,
});

export const ReportInputSchema = z.object({
  patch: z.string(),
  tier: z.enum(["IRON_BRONZE", "SILVER_GOLD", "PLAT_EMERALD", "DIAMOND", "MASTER_PLUS"]),
  teamBlue: z.array(ChampionPickSchema).length(5),
  teamRed: z.array(ChampionPickSchema).length(5),
  myPick: ChampionPickSchema,
});

export type ReportInput = z.infer<typeof ReportInputSchema>;

// ---- 출력 스키마 ----
export const PriorityEnum = z.enum(["US_STRONG", "EVEN", "ENEMY_STRONG"]);
export const SidedPriorityEnum = z.enum(["US", "EVEN", "ENEMY"]);

const LaneAnalysisSchema = z.object({
  lane: GeoLaneEnum,
  matchup: z.string(),
  priority: PriorityEnum,
  level2_priority: SidedPriorityEnum,
  push_priority: SidedPriorityEnum,
  gank_vulnerability: z.enum(["LOW", "MEDIUM", "HIGH"]),
  key_action: z.string(),
  key_avoid: z.string(),
});

const CounterSchema = z.object({
  enemy_champion: z.string(),
  threat_level: z.enum(["HIGH", "MEDIUM"]),
  key_timing: z.string(),
  how_to_play: z.string(),
});

const JunglePathSchema = z.object({
  plan: z.enum(["3CAMP", "4CAMP", "FULL_CLEAR"]),
  clear_speed: z.enum(["FAST", "NORMAL", "SLOW"]),
  power_window: z.string(),
  first_gank_priority: z.array(GeoLaneEnum).min(1).max(3),
  enemy_jungler_warning: z.string(),
});

const TimelineOpsSchema = z.object({
  "0-5": z.string(),
  "6-10": z.string(),
  "10-14": z.string(),
  "15+": z.string(),
});

const KeyTriggerSchema = z.object({
  champion: z.string().describe("한글 챔피언명 (트리거를 만드는 챔프, 우리 팀 또는 적 팀)"),
  when: z
    .string()
    .describe("이 챔피언이 만드는 신호/조건 1문장. 예: '요릭 사이드에 적 2명 이상'"),
  team_does: z
    .string()
    .describe(
      "신호 발생 시 팀이 즉시 할 행동 1-2문장. 예: '본대는 반대 오브젝트 즉시 시작, 미드 타워 압박'",
    ),
});

export const ReportOutputSchema = z.object({
  key_orders: z
    .array(z.string().max(60))
    .length(3)
    .describe("게임 시작 직전 외칠 핵심 오더 3줄. 각 줄 40자 이내."),

  summary: z.object({
    headline: z.string(),
    early_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    mid_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    late_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    win_condition: z.string(),
    key_risk: z.string(),
  }),

  // ★ 팀 운영 유형 분류 (핵심)
  team_operation: z.object({
    our_main: OperationEnum.describe("우리팀 주 운영 유형"),
    our_sub: OperationEnum.nullable().describe(
      "보조 운영. 명확히 두 번째 운영이 있을 때만 채움. 없으면 null.",
    ),
    our_style: z
      .string()
      .describe("우리팀 운영 스타일 한 문장 (예: '요릭 사이드 + 본대 CC 연계 한타')"),
    our_strengths: z
      .array(z.string().max(14))
      .min(2)
      .max(4)
      .describe("우리팀 강점 키워드 2~4개, 각 14자 이내"),
    enemy_main: OperationEnum,
    enemy_sub: OperationEnum.nullable(),
    enemy_style: z.string(),
    enemy_strengths: z.array(z.string().max(14)).min(2).max(4),
  }),

  // ★ 승리 공식 (이 판을 어떻게 이기는가)
  win_formulas: z.object({
    us: z
      .string()
      .describe(
        "우리팀이 이기는 그림. 1~2문장. 누가 무엇을 만들고 누가 받아치는지의 흐름.",
      ),
    them: z
      .string()
      .describe("적이 이기는 그림. 우리가 막아야 할 시나리오."),
  }),

  // ★ 핵심 팀 트리거 (1~3개) — 신호 → 팀 반응
  key_triggers: z
    .array(KeyTriggerSchema)
    .min(1)
    .max(3)
    .describe(
      "이번 판 핵심 트리거 1~3개. '챔피언 X가 상황 Y를 만들면 팀은 Z를 한다.' 형태. 우리팀 또는 적팀 트리거 둘 다 가능.",
    ),

  // 내 챔피언 가이드 (간소화)
  my_champion_guide: z.object({
    role_this_game: z.string(),
    early_plan: z.string(),
    mid_plan: z.string(),
    teamfight_role: z.string(),
  }),

  // ★ 첫 5분 행동 (1순위 즉시 행동)
  first_5_min: z.string().describe("첫 5분 동안 팀이 할 일 1-2문장"),

  // ★ 팀 차원 교전 조건
  fight_conditions: z.object({
    when: z.string().describe("싸워도 되는 조건 1-2문장"),
    avoid: z.string().describe("피해야 할 교전 조건 1-2문장"),
  }),

  jungle_path: JunglePathSchema.nullable(),

  // 시간별 주도권 곡선 (결정론, LLM 미경유)
  lane_priority_timeline: z
    .array(
      z.object({
        lane: GeoLaneEnum,
        points: z.array(z.object({ t: z.number(), value: z.number() })),
      }),
    )
    .length(4)
    .optional(),
  team_priority_timeline: z
    .array(z.object({ t: z.number(), value: z.number() }))
    .optional(),
});

export type ReportOutput = z.infer<typeof ReportOutputSchema>;
