import { NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";
import { extractJson } from "@/lib/extract-json";
import { normalizeLaneFields } from "@/lib/normalize";
import { getChampionByKey, getChampionKnowledge } from "@/lib/champions";
import {
  ReportInputSchema,
  ReportOutputSchema,
  type ReportInput,
  type ReportOutput,
} from "@/lib/schema";
import {
  generateTeamStrategy,
  type TeamPick,
} from "@/lib/strategy/team-generate";
import {
  SYNTHESIS_SYSTEM,
  SynthesisLLMOutputSchema,
  buildSynthesisUserPrompt,
} from "@/lib/strategy/synthesis-prompt";
import type { TeamStrategy } from "@/lib/strategy/team-schema";
import {
  computeLanePriorityTimeline,
  computeTeamPriorityTimeline,
} from "@/lib/strategy/lane-curve";

const SYNTHESIS_MODEL = "claude-opus-4-7";

export const runtime = "nodejs";
export const maxDuration = 60;

// CORS preflight (Capacitor WebView origin과 cross-origin)
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

const resolveMyTeam = (input: ReportInput): "BLUE" | "RED" => {
  const inBlue = input.teamBlue.some(
    (p) =>
      p.championKey === input.myPick.championKey &&
      p.lane === input.myPick.lane,
  );
  if (inBlue) return "BLUE";
  const inRed = input.teamRed.some(
    (p) =>
      p.championKey === input.myPick.championKey &&
      p.lane === input.myPick.lane,
  );
  if (inRed) return "RED";
  throw new Error("myPick이 teamBlue/teamRed 어느 쪽에도 포함되어 있지 않습니다.");
};

const resolveName = (championKey: string): string => {
  const c = getChampionByKey(championKey);
  if (!c) throw new Error(`Unknown champion key: ${championKey}`);
  return c.name_ko;
};

// 결정론 필드 채우기 - LLM 안 거침
const buildDeterministicFields = (
  ourStrategy: TeamStrategy,
  enemyStrategy: TeamStrategy,
) => {
  const team_operation = {
    our_main: ourStrategy.operation_main,
    our_sub: ourStrategy.operation_sub,
    our_style: ourStrategy.style,
    our_strengths: ourStrategy.strengths,
    enemy_main: enemyStrategy.operation_main,
    enemy_sub: enemyStrategy.operation_sub,
    enemy_style: enemyStrategy.style,
    enemy_strengths: enemyStrategy.strengths,
  };

  const win_formulas = {
    us: ourStrategy.win_formula,
    them: enemyStrategy.win_formula,
  };

  // 핵심 트리거 선별: 양 팀 team_triggers 의 첫 항목을 우선 (Sonnet이 중요도 순으로 출력하길 기대)
  // 우리·적 1개씩 합쳐 2개, 우리 두 번째 있으면 3번째로
  const triggers: ReportOutput["key_triggers"] = [];
  if (ourStrategy.team_triggers[0])
    triggers.push(ourStrategy.team_triggers[0]);
  if (enemyStrategy.team_triggers[0])
    triggers.push(enemyStrategy.team_triggers[0]);
  if (ourStrategy.team_triggers[1] && triggers.length < 3)
    triggers.push(ourStrategy.team_triggers[1]);

  return { team_operation, win_formulas, key_triggers: triggers };
};

// LLM이 my_champion_guide 등의 필드를 누락하는 경우 안전한 폴백을 채워 검증 실패 방지.
function healMissingFields(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;

  const guide = o.my_champion_guide as Record<string, unknown> | undefined;
  if (guide && typeof guide === "object") {
    const fb =
      (typeof guide.role_this_game === "string" && guide.role_this_game) ||
      (typeof guide.teamfight_role === "string" && guide.teamfight_role) ||
      "팀과 합류해 본인 역할 수행";
    if (typeof guide.role_this_game !== "string") guide.role_this_game = fb;
    if (typeof guide.early_plan !== "string") guide.early_plan = fb;
    if (typeof guide.mid_plan !== "string") guide.mid_plan = fb;
    if (typeof guide.teamfight_role !== "string") guide.teamfight_role = fb;
  }

  const fc = o.fight_conditions as Record<string, unknown> | undefined;
  if (fc && typeof fc === "object") {
    if (typeof fc.when !== "string") fc.when = "트리거 발생 시";
    if (typeof fc.avoid !== "string") fc.avoid = "트리거 없을 때";
  }

  const sum = o.summary as Record<string, unknown> | undefined;
  if (sum && typeof sum === "object") {
    if (typeof sum.headline !== "string") sum.headline = "이번 판 운영 가이드.";
    if (typeof sum.win_condition !== "string")
      sum.win_condition = "트리거 발생 시 즉시 행동.";
    if (typeof sum.key_risk !== "string")
      sum.key_risk = "단독 행동으로 잘려나가지 마라.";
  }
}

export async function POST(req: Request) {
  let input: ReportInput;
  try {
    const body = await req.json();
    input = ReportInputSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  let myTeamSide: "BLUE" | "RED";
  try {
    myTeamSide = resolveMyTeam(input);
  } catch (err) {
    return NextResponse.json(
      {
        error: "INVALID_MY_PICK",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const ourPicks: TeamPick[] =
    myTeamSide === "BLUE" ? input.teamBlue : input.teamRed;
  const enemyPicks: TeamPick[] =
    myTeamSide === "BLUE" ? input.teamRed : input.teamBlue;

  // 1단계: 양 팀 전략 병렬 생성 (캐시 우선)
  const t0 = Date.now();
  let ourStrategyResult, enemyStrategyResult;
  try {
    [ourStrategyResult, enemyStrategyResult] = await Promise.all([
      generateTeamStrategy({ patch: input.patch, picks: ourPicks }),
      generateTeamStrategy({ patch: input.patch, picks: enemyPicks }),
    ]);
  } catch (err) {
    return NextResponse.json(
      {
        error: "TEAM_STRATEGY_FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
  const tStrategy = Date.now() - t0;
  console.log(
    `[report] team strategies: our=${ourStrategyResult.cached ? "CACHED" : "GEN"} enemy=${enemyStrategyResult.cached ? "CACHED" : "GEN"} (${tStrategy}ms)`,
  );

  // 2단계: 결정론 필드 (코드로 직접 채움)
  const deterministic = buildDeterministicFields(
    ourStrategyResult.strategy,
    enemyStrategyResult.strategy,
  );

  // 3단계: 합성 호출 (Opus) - 축소된 출력만
  const myChampionKnowledge = getChampionKnowledge(input.myPick.championKey);
  const myChampionNote = myChampionKnowledge
    ? {
        championName: myChampionKnowledge.name,
        tags: myChampionKnowledge.tags,
        identity: myChampionKnowledge.identity,
        power_window: myChampionKnowledge.power_window,
        damage_type: myChampionKnowledge.damage_type,
        powerspikes: myChampionKnowledge.powerspikes,
        strengths: myChampionKnowledge.strengths,
        weaknesses: myChampionKnowledge.weaknesses,
        passive: myChampionKnowledge.passive,
        Q: myChampionKnowledge.Q,
        W: myChampionKnowledge.W,
        E: myChampionKnowledge.E,
        R: myChampionKnowledge.R,
      }
    : undefined;

  const userPrompt = buildSynthesisUserPrompt({
    patch: input.patch,
    tier: input.tier,
    ourTeam: {
      picks: ourPicks.map((p) => ({
        championName: resolveName(p.championKey),
        lane: p.lane,
      })),
      strategy: ourStrategyResult.strategy,
    },
    enemyTeam: {
      picks: enemyPicks.map((p) => ({
        championName: resolveName(p.championKey),
        lane: p.lane,
      })),
      strategy: enemyStrategyResult.strategy,
    },
    myPick: {
      championName: resolveName(input.myPick.championKey),
      lane: input.myPick.lane,
    },
    myChampionNote,
  });

  const client = getAnthropic();
  let lastError: string | null = null;
  const t1 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const extra =
        attempt === 0
          ? undefined
          : `이전 응답이 스키마 검증에 실패했다. 사유: ${lastError}\n반드시 raw JSON만 반환하고 모든 필드를 정확히 채워라.`;
      const msg = await client.messages.create({
        model: SYNTHESIS_MODEL,
        max_tokens: 5000,
        system: SYNTHESIS_SYSTEM,
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
      const raw = block.text;
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[report] synthesis attempt ${attempt + 1} raw (head):`,
          raw.slice(0, 200),
        );
      }
      const parsed = extractJson(raw);
      const normalized = normalizeLaneFields(parsed);
      // LLM이 가끔 my_champion_guide의 일부 필드를 누락 → role_this_game으로 폴백
      healMissingFields(normalized);
      const llmOutput = SynthesisLLMOutputSchema.parse(normalized);

      // 결정론 시계열 (LLM 미경유)
      const lanePriorityTimeline = computeLanePriorityTimeline(
        ourPicks,
        enemyPicks,
      );
      const teamPriorityTimeline = computeTeamPriorityTimeline(
        ourPicks,
        enemyPicks,
      );

      // 결정론 + LLM 출력 병합
      const merged: ReportOutput = {
        ...llmOutput,
        team_operation: deterministic.team_operation,
        win_formulas: deterministic.win_formulas,
        key_triggers: deterministic.key_triggers,
        lane_priority_timeline: lanePriorityTimeline,
        team_priority_timeline: teamPriorityTimeline,
      };

      // 최종 스키마 검증 (안전망)
      const validated = ReportOutputSchema.parse(merged);

      if (input.myPick.lane === "JUNGLE" && validated.jungle_path === null) {
        lastError = "내 챔피언이 정글인데 jungle_path가 null이다.";
        continue;
      }

      const tSynth = Date.now() - t1;
      console.log(
        `[report] synthesis ok (${tSynth}ms, total ${tStrategy + tSynth}ms)`,
      );
      return NextResponse.json({
        report: validated,
        input,
        meta: {
          strategy_cache: {
            our: ourStrategyResult.cached,
            enemy: enemyStrategyResult.cached,
          },
          timing_ms: {
            strategy: tStrategy,
            synthesis: tSynth,
            total: tStrategy + tSynth,
          },
        },
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(
        `[report] synthesis attempt ${attempt + 1} failed:`,
        lastError,
      );
    }
  }

  return NextResponse.json(
    { error: "SYNTHESIS_FAILED", detail: lastError },
    { status: 502 },
  );
}
