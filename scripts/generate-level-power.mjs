// 챔피언별 라인 적합도 + 레벨 스파이크/라인전 강도를 Claude로 생성하여
// data/level-power-rankings.json 에 병합한다.
//
// 실행: node scripts/generate-level-power.mjs
// 옵션:
//   SAMPLE=Aatrox,LeeSin   특정 챔피언만
//   FORCE=1                이미 채워진 챔피언도 재생성
//   MODEL=claude-sonnet-4-6 (기본) / claude-haiku-4-5-20251001
//   BATCH=6                동시 처리 수
//   DELAY_MS=0             배치 간 대기

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

const envLocal = resolve(process.cwd(), ".env.local");
const envDefault = resolve(process.cwd(), ".env");
dotenv.config({ path: existsSync(envLocal) ? envLocal : envDefault });

const KNOWLEDGE_PATH = resolve(process.cwd(), "data/champion-knowledge.json");
const RANKINGS_PATH = resolve(process.cwd(), "data/level-power-rankings.json");
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const FORCE = process.env.FORCE === "1";
const SAMPLE = process.env.SAMPLE
  ? process.env.SAMPLE.split(",").map((s) => s.trim())
  : null;
const BATCH = Number(process.env.BATCH || 6);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM"];

const SYSTEM = `당신은 리그 오브 레전드의 시니어 코치다.
한 챔피언에 대해 어느 라인에서 플레이 가능하고, 그 라인에서 (1) 핵심 레벨 스파이크 강도, (2) 라인전 종합 강도를 정리한다.

# 라인 분류 (반드시 이 중에서)
- TOP / JUNGLE / MID / BOTTOM
- BOTTOM 은 봇 듀오 (원딜 또는 서포터). 둘 다 BOTTOM 으로 분류.

# 점수 의미
- JUNGLE 의 level_spike = 3렙(첫 3캠프 후) 정글 강도.
  - 5: 카정 압박/갱 위협이 매우 강함 (예: 리신, 엘리스)
  - 3: 보통
  - 1: 3렙 시점 매우 약함 (예: 카서스 초반, 마스터 이)
- TOP/MID/BOTTOM 의 level_spike = 2렙(첫 미니언 웨이브 직후) 라인 강도.
  - 5: 2렙 올인/주도권 매우 강함 (예: 다리우스, 레오나, 노틸러스)
  - 3: 보통
  - 1: 2렙 시점 매우 약함
- TOP/MID/BOTTOM 의 laning = 6렙 전후 라인전 종합 강도(견제/체력 관리/2렙·6렙 스파이크 종합).
  - 5: 라인전 압도 (예: 르블랑, 다리우스)
  - 1: 라인전 매우 약함 (예: 카사딘, 베인 초반)

# 다중 라인
- 실전에서 자주 가는 라인만 roles에 포함. 가능성 낮은 라인은 제외.
- 예: 아칼리 → ["TOP", "MID"], 세트 → ["TOP", "SUPPORT는 없으니 BOTTOM 제외"], 럭스 → ["MID", "BOTTOM"].

# 출력 규칙
- raw JSON 만. 코드 펜스 금지.
- 한국어 주석 금지 (JSON 파싱 안 됨).

# 출력 스키마
{
  "roles": ["TOP" | "JUNGLE" | "MID" | "BOTTOM", ...],   // 1개 이상
  "by_lane": {
    "<LANE>": {
      "level_spike": 1~5,
      "laning": 1~5         // JUNGLE 라인이면 이 필드 생략
    }
    // roles 에 든 라인마다 entry
  }
}`;

const buildUser = (entry) => `# 챔피언: ${entry.name} (${entry.title})
- 태그: ${entry.tags.join("/")}
- 능력치: ${entry.info}
- 자원: ${entry.resource}
${entry.passive}
${entry.Q}
${entry.W}
${entry.E}
${entry.R}
${entry.identity ? `\n# 정체성\n${entry.identity}` : ""}
${entry.power ? `# 파워커브\nearly=${entry.power.early} mid=${entry.power.mid} late=${entry.power.late}` : ""}
${entry.powerspikes ? `# 파워스파이크\n- ${entry.powerspikes.join("\n- ")}` : ""}

위 정보를 바탕으로 이 챔피언의 주 라인과 라인별 레벨 스파이크/라인전 강도를 JSON으로 정리하라.`;

const extractJson = (text) => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try {
      return JSON.parse(m[1].trim());
    } catch {}
  }
  const a = trimmed.indexOf("{");
  const b = trimmed.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(trimmed.slice(a, b + 1));
    } catch {}
  }
  throw new Error("JSON parse fail: " + trimmed.slice(0, 200));
};

const inRange = (n) => typeof n === "number" && n >= 1 && n <= 5;

const validate = (obj) => {
  if (!Array.isArray(obj.roles) || obj.roles.length === 0)
    throw new Error("roles empty");
  for (const r of obj.roles) {
    if (!VALID_ROLES.includes(r)) throw new Error(`bad role: ${r}`);
  }
  if (!obj.by_lane || typeof obj.by_lane !== "object")
    throw new Error("by_lane missing");
  for (const r of obj.roles) {
    const s = obj.by_lane[r];
    if (!s) throw new Error(`by_lane.${r} missing`);
    if (!inRange(s.level_spike))
      throw new Error(`by_lane.${r}.level_spike out of range`);
    if (r === "JUNGLE") {
      // laning 무시 (있어도 제거)
      delete s.laning;
    } else {
      if (!inRange(s.laning))
        throw new Error(`by_lane.${r}.laning out of range`);
    }
  }
  // roles 에 없는 키는 제거
  for (const k of Object.keys(obj.by_lane)) {
    if (!obj.roles.includes(k)) delete obj.by_lane[k];
  }
  return { roles: obj.roles, by_lane: obj.by_lane };
};

const generateForChampion = async (key, entry) => {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUser(entry) }],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text");
  const parsed = extractJson(block.text);
  return validate(parsed);
};

const main = async () => {
  const knowledge = JSON.parse(readFileSync(KNOWLEDGE_PATH, "utf-8"));
  const rankings = JSON.parse(readFileSync(RANKINGS_PATH, "utf-8"));

  let targets = Object.keys(knowledge).filter((k) => !k.startsWith("_"));
  if (SAMPLE) targets = targets.filter((k) => SAMPLE.includes(k));
  if (!FORCE) targets = targets.filter((k) => !rankings[k]);

  console.log(
    `대상: ${targets.length}명 (모델: ${MODEL}, 배치: ${BATCH}${FORCE ? ", FORCE" : ""}${SAMPLE ? ", SAMPLE" : ""})`,
  );
  if (targets.length === 0) {
    console.log("이미 모두 채워짐. (FORCE=1 로 재생성 가능)");
    return;
  }

  let done = 0;
  const failed = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      slice.map(async (key) => {
        const generated = await generateForChampion(key, knowledge[key]);
        return { key, generated };
      }),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const key = slice[j];
      if (r.status === "fulfilled") {
        rankings[key] = r.value.generated;
        done++;
      } else {
        console.error(`  ✗ ${key}: ${r.reason?.message ?? r.reason}`);
        failed.push(key);
      }
    }
    rankings._generated_at = new Date().toISOString();
    writeFileSync(RANKINGS_PATH, JSON.stringify(rankings, null, 2), "utf-8");
    console.log(
      `  ${Math.min(i + BATCH, targets.length)}/${targets.length} (성공 ${done}, 실패 ${failed.length})`,
    );
    if (i + BATCH < targets.length) {
      const delay = Number(process.env.DELAY_MS || 0);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(`\n✔ 완료. 성공 ${done}, 실패 ${failed.length}`);
  if (failed.length) console.log("실패:", failed.join(", "));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
