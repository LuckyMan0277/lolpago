// 합성 단계 프롬프트. 두 팀 전략 + 내 픽 → ReportOutput 의 일부 (다이어트 후).
//
// 결정론 필드 (코드에서 채움): team_operation / win_formulas / key_triggers / lane_priority_timeline / team_priority_timeline
// LLM 생성 필드: key_orders, summary, my_champion_guide, first_5_min, fight_conditions, jungle_path

import { z } from "zod";
import type { TeamStrategy } from "./team-schema";

// LLM이 생성하는 축소 스키마
export const SynthesisLLMOutputSchema = z.object({
  key_orders: z.array(z.string().max(60)).length(3),
  summary: z.object({
    headline: z.string(),
    early_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    mid_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    late_phase: z.enum(["GOOD", "EVEN", "BAD"]),
    win_condition: z.string(),
    key_risk: z.string(),
  }),
  my_champion_guide: z.object({
    role_this_game: z.string(),
    early_plan: z.string(),
    mid_plan: z.string(),
    teamfight_role: z.string(),
  }),
  first_5_min: z.string(),
  fight_conditions: z.object({
    when: z.string(),
    avoid: z.string(),
  }),
  jungle_path: z
    .object({
      plan: z.enum(["3CAMP", "4CAMP", "FULL_CLEAR"]),
      clear_speed: z.enum(["FAST", "NORMAL", "SLOW"]),
      power_window: z.string(),
      first_gank_priority: z.array(z.enum(["TOP", "JUNGLE", "MID", "BOTTOM"])).min(1).max(3),
      enemy_jungler_warning: z.string(),
    })
    .nullable(),
});

export type SynthesisLLMOutput = z.infer<typeof SynthesisLLMOutputSchema>;

const SYNTHESIS_OUTPUT_TEMPLATE = `{
  "key_orders": [
    "1줄 (40자, 초반 행동)",
    "2줄 (40자, 중반 핵심)",
    "3줄 (40자, 후반/승리 조건)"
  ],
  "summary": {
    "headline": "이번 판 요약 2-3문장",
    "early_phase": "GOOD | EVEN | BAD",
    "mid_phase":   "GOOD | EVEN | BAD",
    "late_phase":  "GOOD | EVEN | BAD",
    "win_condition": "핵심 승리 조건 1문장",
    "key_risk": "핵심 위험 요소 1문장"
  },
  "my_champion_guide": {
    "role_this_game": "이번 판 역할 1문장",
    "early_plan": "초반 1-2문장",
    "mid_plan": "중반 1-2문장",
    "teamfight_role": "한타 역할 1문장"
  },
  "first_5_min": "첫 5분 행동 1-2문장",
  "fight_conditions": {
    "when": "싸워도 되는 조건 1-2문장",
    "avoid": "피해야 할 교전 조건 1-2문장"
  },
  "jungle_path": {
    "plan": "3CAMP | 4CAMP | FULL_CLEAR",
    "clear_speed": "FAST | NORMAL | SLOW",
    "power_window": "내 정글러 파워 타이밍",
    "first_gank_priority": ["BOTTOM"],
    "enemy_jungler_warning": "상대 정글 핵심 위협 1문장"
  }
  // 내 챔피언이 정글이 아니면 jungle_path는 null
}`;

export const SYNTHESIS_SYSTEM = `당신은 LoL의 시니어 팀 운영 코치다.

# 입력
- 우리·적 팀 전략 (사전 분석 완료, JSON)
- 내가 플레이하는 챔피언 + 포지션
- 패치/티어
- 내 챔피언 공식 정보

# 너의 작업 (다음만 만든다)
1. key_orders (3줄 외칠 수 있는 오더)
2. summary (페이즈 + 헤드라인 + 승리 조건/위험)
3. my_champion_guide (내 픽 한정 역할·플랜)
4. first_5_min (초반 행동)
5. fight_conditions (싸울 때 / 피할 때)
6. jungle_path (내가 정글일 때만, 아니면 null)

# 절대 만들지 않는 것 (코드가 채움)
- team_operation, win_formulas, key_triggers, lane_priority_timeline, team_priority_timeline
- 라인별 매치업 텍스트, 시간대별 운영 텍스트, 상대 위협 카운터, 하지 말 것 리스트

# 핵심 원칙
1. 챔피언 설명이 아니라 행동 추천.
2. 단정 금지 ("100%", "확실히" X). 승률 표현 금지.
3. 메인 문장 50자 이내 권장.
4. "왜"보다 "무엇을 해야 하는가"가 먼저.

# 출력 형식
- raw JSON만. 코드 펜스 금지. 첫 글자 '{'.
- 아래 템플릿 키·enum 정확히.
- **my_champion_guide는 정확히 4개 필드: role_this_game / early_plan / mid_plan / teamfight_role. 하나도 빠뜨리지 마라.**
- summary는 정확히 6개 필드: headline / early_phase / mid_phase / late_phase / win_condition / key_risk.
- fight_conditions는 정확히 2개: when / avoid.
- jungle_path: 내가 정글일 때만 채움. 아니면 null.

# 출력 JSON 템플릿
${SYNTHESIS_OUTPUT_TEMPLATE}`;

type ChampionNote = {
  championName: string;
  tags?: string[];
  identity?: string;
  power_window?: string;
  damage_type?: string;
  powerspikes?: string[];
  strengths?: string[];
  weaknesses?: string[];
  passive?: string;
  Q?: string;
  W?: string;
  E?: string;
  R?: string;
};

export const buildSynthesisUserPrompt = (input: {
  patch: string;
  tier: string;
  ourTeam: {
    picks: Array<{ championName: string; lane: string }>;
    strategy: TeamStrategy;
  };
  enemyTeam: {
    picks: Array<{ championName: string; lane: string }>;
    strategy: TeamStrategy;
  };
  myPick: { championName: string; lane: string };
  myChampionNote?: ChampionNote;
}) => {
  const lines: string[] = [
    `# 매치 정보`,
    `- 패치: ${input.patch}`,
    `- 티어: ${input.tier}`,
    ``,
    `# 우리 팀`,
    ...input.ourTeam.picks.map((p) => `- ${p.lane}: ${p.championName}`),
    ``,
    `# 적 팀`,
    ...input.enemyTeam.picks.map((p) => `- ${p.lane}: ${p.championName}`),
    ``,
    `# 내가 플레이하는 챔피언`,
    `- ${input.myPick.lane}: ${input.myPick.championName}`,
    ``,
    `# 우리 팀 전략 (사전 분석)`,
    "```json",
    JSON.stringify(input.ourTeam.strategy, null, 2),
    "```",
    ``,
    `# 적 팀 전략 (사전 분석)`,
    "```json",
    JSON.stringify(input.enemyTeam.strategy, null, 2),
    "```",
    ``,
  ];

  if (input.myChampionNote) {
    const c = input.myChampionNote;
    lines.push(`# 내 챔피언 공식 정보`);
    if (c.identity) lines.push(`- 정체성: ${c.identity}`);
    if (c.power_window) lines.push(`- 파워창: ${c.power_window}`);
    if (c.damage_type) lines.push(`- 피해타입: ${c.damage_type}`);
    if (c.powerspikes?.length)
      lines.push(`- 파워스파이크: ${c.powerspikes.join(" / ")}`);
    if (c.strengths?.length) lines.push(`- 강점: ${c.strengths.join(" / ")}`);
    if (c.weaknesses?.length) lines.push(`- 약점: ${c.weaknesses.join(" / ")}`);
    if (c.passive) lines.push(`- ${c.passive}`);
    if (c.Q) lines.push(`- ${c.Q}`);
    if (c.W) lines.push(`- ${c.W}`);
    if (c.E) lines.push(`- ${c.E}`);
    if (c.R) lines.push(`- ${c.R}`);
    lines.push(``);
  }

  lines.push(
    `# 작업`,
    `위 양 팀 전략을 참고하여 시스템 프롬프트 템플릿의 필드만 JSON으로 채워라.`,
    `team_operation / win_formulas / key_triggers / 시계열 / 라인 분석 / 시간대 운영 / 위협 / 하지말것 은 절대 만들지 마라 (코드가 채움).`,
    `반드시 raw JSON만. 첫 글자 '{'.`,
  );
  return lines.join("\n");
};
