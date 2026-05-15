// 팀 전략 생성 (캐시 우선). 캐시 미스 시 Claude 호출.

import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "@/lib/extract-json";
import { getAnthropic } from "@/lib/anthropic";
import { getChampionByKey, getChampionKnowledge } from "@/lib/champions";
import {
  TeamStrategySchema,
  type TeamStrategy,
} from "./team-schema";
import {
  TEAM_STRATEGY_SYSTEM,
  buildTeamStrategyUserPrompt,
} from "./team-prompt";
import { buildCacheKey, getCached, setCached } from "./cache";

const TEAM_MODEL = "claude-sonnet-4-6";

const callClaude = async (
  client: Anthropic,
  userPrompt: string,
  extra?: string,
) => {
  const msg = await client.messages.create({
    model: TEAM_MODEL,
    max_tokens: 3500,
    system: TEAM_STRATEGY_SYSTEM,
    messages: [
      {
        role: "user",
        content: extra ? `${userPrompt}\n\n${extra}` : userPrompt,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude 응답에 text 블록이 없습니다.");
  }
  return block.text;
};

export type TeamPick = { championKey: string; lane: string };

export type TeamStrategyResult = {
  strategy: TeamStrategy;
  cached: boolean;
};

const buildNotes = (picks: TeamPick[]) => {
  const notes: Array<{
    championName: string;
    tags?: string[];
    identity?: string;
    power?: { early: number; mid: number; late: number };
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
  }> = [];
  for (const p of picks) {
    const k = getChampionKnowledge(p.championKey);
    if (k) {
      notes.push({
        championName: k.name,
        tags: k.tags,
        identity: k.identity,
        power: k.power,
        power_window: k.power_window,
        damage_type: k.damage_type,
        powerspikes: k.powerspikes,
        strengths: k.strengths,
        weaknesses: k.weaknesses,
        passive: k.passive,
        Q: k.Q,
        W: k.W,
        E: k.E,
        R: k.R,
      });
    }
  }
  return notes;
};

export const generateTeamStrategy = async (input: {
  patch: string;
  picks: TeamPick[];
}): Promise<TeamStrategyResult> => {
  const cacheKey = buildCacheKey(input.patch, input.picks);
  const cached = getCached(cacheKey, input.patch);
  if (cached) {
    return { strategy: cached, cached: true };
  }

  const client = getAnthropic();
  const championNotes = buildNotes(input.picks);
  const namedPicks = input.picks.map((p) => {
    const c = getChampionByKey(p.championKey);
    return {
      championName: c?.name_ko ?? p.championKey,
      lane: p.lane,
    };
  });

  const userPrompt = buildTeamStrategyUserPrompt({
    patch: input.patch,
    picks: namedPicks,
    championNotes,
  });

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const extra =
        attempt === 0
          ? undefined
          : `이전 응답이 스키마 검증에 실패했다. 사유: ${lastError}\n반드시 raw JSON만 반환하고 모든 필드를 정확히 채워라.`;
      const raw = await callClaude(client, userPrompt, extra);
      const parsed = extractJson(raw);
      const validated = TeamStrategySchema.parse(parsed);
      setCached(cacheKey, input.patch, validated);
      return { strategy: validated, cached: false };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(
        `[team-generate] attempt ${attempt + 1} failed:`,
        lastError,
      );
    }
  }
  throw new Error(`팀 전략 생성 실패: ${lastError}`);
};
