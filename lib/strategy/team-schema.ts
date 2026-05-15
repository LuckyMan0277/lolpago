// 단일 팀(5명)의 운영 전략 스키마.
// 이 스키마는 "팀 조합 → 운영 분석" 결과로, 캐시 키(patch + 정렬된 픽)로 저장된다.

import { z } from "zod";
import { OperationEnum } from "@/lib/schema";

const TeamTriggerSchema = z.object({
  champion: z.string().describe("한글 챔피언명 (이 팀 5명 중 하나)"),
  when: z.string().describe("이 챔피언이 만드는 신호/조건 1문장"),
  team_does: z.string().describe("팀이 즉시 할 행동 1-2문장"),
});

export const TeamStrategySchema = z.object({
  composition_summary: z
    .string()
    .describe("팀 한 줄 요약 (예: '말파-사일러스-나피리-애쉬-룰루 한타 조합')"),

  operation_main: OperationEnum.describe("주 운영 유형"),
  operation_sub: OperationEnum.nullable().describe(
    "보조 운영. 명확하지 않으면 null.",
  ),

  style: z.string().describe("팀 운영 스타일 한 문장"),

  strengths: z
    .array(z.string().max(14))
    .min(2)
    .max(4)
    .describe("강점 키워드 2~4개, 각 14자 이내"),
  weaknesses: z
    .array(z.string().max(14))
    .min(2)
    .max(4)
    .describe("약점 키워드 2~4개, 각 14자 이내"),

  win_formula: z
    .string()
    .max(80)
    .describe(
      "이 팀이 이기는 그림. 한 문장, 60자 이내. 핵심 트리거→결과만 짧게.",
    ),

  team_triggers: z
    .array(TeamTriggerSchema)
    .min(2)
    .max(4)
    .describe("이 팀의 핵심 트리거 2~4개"),

  power_curve: z.object({
    early: z.number().int().min(1).max(5),
    mid: z.number().int().min(1).max(5),
    late: z.number().int().min(1).max(5),
  }),

  ideal_scenario: z
    .string()
    .describe("이 팀이 가장 빛나는 시나리오 1문장"),
  collapse_scenario: z
    .string()
    .describe("이 팀이 무너지는 시나리오 1문장"),
});

export type TeamStrategy = z.infer<typeof TeamStrategySchema>;
