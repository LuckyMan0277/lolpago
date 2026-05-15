// Data Dragon에서 챔피언 메타데이터를 받아 data/champions.json으로 저장.
// 실행: node scripts/sync-champions.mjs

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const versionsRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
const versions = await versionsRes.json();
const latest = versions[0];

const fetchLocale = async (locale) => {
  const url = `https://ddragon.leagueoflegends.com/cdn/${latest}/data/${locale}/champion.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${locale}: ${res.status}`);
  return (await res.json()).data;
};

const [enData, koData] = await Promise.all([
  fetchLocale("en_US"),
  fetchLocale("ko_KR"),
]);

const champions = Object.values(enData)
  .map((c) => ({
    id: Number(c.key),
    key: c.id,
    name_en: c.name,
    name_ko: koData[c.id]?.name ?? c.name,
    title_ko: koData[c.id]?.title ?? "",
    tags: c.tags,
    info: c.info,
    partype: c.partype,
  }))
  .sort((a, b) => a.name_ko.localeCompare(b.name_ko, "ko"));

const out = {
  patch: latest,
  generated_at: new Date().toISOString(),
  count: champions.length,
  champions,
};

const outPath = resolve(process.cwd(), "data/champions.json");
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
console.log(`✔ ${champions.length} champions saved to ${outPath} (patch ${latest})`);
