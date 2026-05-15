// 챔피언별 power_curve / powerspikes / strengths / weaknesses 를 Claude로 생성하여
// data/champion-knowledge.json 에 병합한다.
//
// 실행: node scripts/generate-champion-strengths.mjs
// 옵션: SAMPLE=Malphite,Teemo,Shaco 로 테스트할 챔피언만 지정 가능
//      FORCE=1 이면 이미 채워진 챔피언도 다시 생성
//      MODEL=claude-sonnet-4-6 (기본) / claude-haiku-4-5-20251001

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

// .env.local 우선, 없으면 .env
const envLocal = resolve(process.cwd(), ".env.local");
const envDefault = resolve(process.cwd(), ".env");
dotenv.config({ path: existsSync(envLocal) ? envLocal : envDefault });

const KNOWLEDGE_PATH = resolve(process.cwd(), "data/champion-knowledge.json");
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const FORCE = process.env.FORCE === "1";
const SAMPLE = process.env.SAMPLE
  ? process.env.SAMPLE.split(",").map((s) => s.trim())
  : null;
const BATCH = Number(process.env.BATCH || 6);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `당신은 LoL의 시니어 코치다.
한 챔피언에 대해 "언제 강한가 / 어떻게 강한가 / 약점" 을 한국어로 정리한다.
입력은 챔피언의 공식 스킬 설명. 일반 LoL 지식과 입력 스킬 메커니즘을 모두 고려하여 정확히 판단해라.

# 출력 규칙
- raw JSON 만. 코드 펜스 금지.
- 모든 필드 채워라.
- 각 항목 길이 제약 엄수.
- 한국어. 명사형 키워드 위주.

# 출력 스키마
{
  "identity": "한 줄 정체성 (예: '초반 약체 → 후반 정면 이니시 탱커'). 40자 이내.",
  "power": { "early": 1~5, "mid": 1~5, "late": 1~5 },  // 5 = 매우 강함, 1 = 매우 약함
  "power_window": "이 챔피언이 가장 강력한 시간대 (예: '6렙 ~ 1코어', '15분 이후 한타'). 30자 이내.",
  "damage_type": "AP | AD | MIXED | TRUE",
  "powerspikes": ["주요 파워 타이밍 2~4개. 각 20자 이내. 예: '6렙 R', '1코어 가시갑옷'"],
  "strengths": ["어떻게 강한가 2~4개. 명사형 키워드 14자 이내. 예: '광역 이니시', '한타 가치', '카정 압박'"],
  "weaknesses": ["약점 2~4개. 명사형 키워드 14자 이내. 예: '원거리 견제 취약', '이동기 부재', '초반 라인전 약함'"]
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

위 정보를 바탕으로 이 챔피언의 정체성·파워커브·강점·약점을 JSON으로 정리하라.`;

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

const validate = (obj) => {
  if (typeof obj.identity !== "string") throw new Error("identity");
  if (!obj.power || typeof obj.power.early !== "number") throw new Error("power");
  if (!["AP", "AD", "MIXED", "TRUE"].includes(obj.damage_type))
    throw new Error("damage_type");
  if (!Array.isArray(obj.powerspikes) || obj.powerspikes.length < 2)
    throw new Error("powerspikes");
  if (!Array.isArray(obj.strengths) || obj.strengths.length < 2)
    throw new Error("strengths");
  if (!Array.isArray(obj.weaknesses) || obj.weaknesses.length < 2)
    throw new Error("weaknesses");
  return obj;
};

const generateForChampion = async (key, entry) => {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUser(entry) }],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("no text");
  const parsed = extractJson(block.text);
  return validate(parsed);
};

const main = async () => {
  const raw = JSON.parse(readFileSync(KNOWLEDGE_PATH, "utf-8"));
  let targets = Object.keys(raw).filter((k) => !k.startsWith("_"));
  if (SAMPLE) targets = targets.filter((k) => SAMPLE.includes(k));
  if (!FORCE) targets = targets.filter((k) => !raw[k].power);

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
        const generated = await generateForChampion(key, raw[key]);
        return { key, generated };
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        const { key, generated } = r.value;
        raw[key] = { ...raw[key], ...generated };
        done++;
      } else {
        const errKey = slice[results.indexOf(r)];
        console.error(`  ✗ ${errKey}: ${r.reason?.message ?? r.reason}`);
        failed.push(errKey);
      }
    }
    // 부분 저장 (긴 작업에서 중간에 죽어도 진행 보존)
    writeFileSync(KNOWLEDGE_PATH, JSON.stringify(raw, null, 2), "utf-8");
    console.log(
      `  ${Math.min(i + BATCH, targets.length)}/${targets.length} (성공 ${done}, 실패 ${failed.length})`,
    );
    // rate limit 대비 짧은 대기 (다음 라운드 전)
    if (i + BATCH < targets.length) {
      const delay = Number(process.env.DELAY_MS || 0);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }

  raw._last_strength_gen = new Date().toISOString();
  writeFileSync(KNOWLEDGE_PATH, JSON.stringify(raw, null, 2), "utf-8");
  console.log(`\n✔ 완료. 성공 ${done}, 실패 ${failed.length}`);
  if (failed.length) console.log("실패:", failed.join(", "));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
