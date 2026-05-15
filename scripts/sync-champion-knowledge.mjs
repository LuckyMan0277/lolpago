// Data Dragon 공식 데이터에서 165명 챔피언의 스킬/특성을 가져와
// data/champion-knowledge.json으로 저장한다.
// 실행: node scripts/sync-champion-knowledge.mjs

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_KEYS = ["Q", "W", "E", "R"];

const cleanText = (s) =>
  (s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
};

const versions = await fetchJson("https://ddragon.leagueoflegends.com/api/versions.json");
const PATCH = versions[0];
console.log(`Patch: ${PATCH}`);

const summary = await fetchJson(
  `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/ko_KR/champion.json`,
);

const championKeys = Object.keys(summary.data); // ["Aatrox", "Ahri", ...]
console.log(`총 ${championKeys.length}명 챔피언 동기화 시작...`);

const out = {
  _format:
    "각 챔피언 = { tags, info, resource, passive, Q, W, E, R }. Data Dragon ko_KR 기반. 패치별 sync 필요.",
  _patch: PATCH,
  _generated_at: new Date().toISOString(),
};

// 10개씩 배치로 동시 요청
const batchSize = 10;
for (let i = 0; i < championKeys.length; i += batchSize) {
  const batch = championKeys.slice(i, i + batchSize);
  const results = await Promise.all(
    batch.map(async (key) => {
      const detail = await fetchJson(
        `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/ko_KR/champion/${key}.json`,
      );
      const c = detail.data[key];
      const passive = c.passive;
      const spells = c.spells; // [Q, W, E, R]
      return {
        key,
        entry: {
          name: c.name,
          title: c.title,
          tags: c.tags,
          info: `공격 ${c.info.attack} / 방어 ${c.info.defense} / 마법 ${c.info.magic} / 난이도 ${c.info.difficulty}`,
          resource: c.partype && c.partype.trim() ? c.partype : "없음",
          passive: `[패시브] ${passive.name}: ${cleanText(passive.description)}`,
          Q: `[Q] ${spells[0].name}: ${cleanText(spells[0].description)}`,
          W: `[W] ${spells[1].name}: ${cleanText(spells[1].description)}`,
          E: `[E] ${spells[2].name}: ${cleanText(spells[2].description)}`,
          R: `[R] ${spells[3].name}: ${cleanText(spells[3].description)}`,
        },
      };
    }),
  );
  for (const { key, entry } of results) {
    out[key] = entry;
  }
  console.log(`  ${Math.min(i + batchSize, championKeys.length)}/${championKeys.length}`);
}

const outPath = resolve(process.cwd(), "data/champion-knowledge.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`✔ ${outPath} 작성 완료`);
