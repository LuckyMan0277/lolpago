// LLM이 가끔 라인 enum을 잘못 쓰는 걸 강제로 정규화.
// 라인 분석 / 첫 갱 우선순위는 4개 지리적 라인(TOP/JUNGLE/MID/BOTTOM)으로 통일.
// ADC/SUPPORT/BOT/UTILITY 모두 BOTTOM으로 매핑.

const GEO_LANE_ALIASES: Record<string, string> = {
  ADC: "BOTTOM",
  SUPPORT: "BOTTOM",
  SUP: "BOTTOM",
  BOT: "BOTTOM",
  UTILITY: "BOTTOM",
  UTIL: "BOTTOM",
  AD: "BOTTOM",
  CARRY: "BOTTOM",
  MIDDLE: "MID",
  서폿: "BOTTOM",
  원딜: "BOTTOM",
  바텀: "BOTTOM",
  탑: "TOP",
  정글: "JUNGLE",
  미드: "MID",
};

const normalizeOne = (s: unknown): unknown => {
  if (typeof s !== "string") return s;
  const upper = s.toUpperCase();
  return GEO_LANE_ALIASES[upper] ?? GEO_LANE_ALIASES[s] ?? s;
};

// 객체 트리를 순회하며 lane / first_gank_priority 키의 값을 정규화.
export const normalizeLaneFields = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(normalizeLaneFields);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "lane") {
        out[k] = normalizeOne(v);
      } else if (k === "first_gank_priority" && Array.isArray(v)) {
        // 중복 BOTTOM 제거 (예: ["ADC", "SUPPORT"] → ["BOTTOM"])
        const normalized = v.map(normalizeOne);
        const seen = new Set<unknown>();
        out[k] = normalized.filter((x) => {
          if (seen.has(x)) return false;
          seen.add(x);
          return true;
        });
      } else {
        out[k] = normalizeLaneFields(v);
      }
    }
    return out;
  }
  return obj;
};
