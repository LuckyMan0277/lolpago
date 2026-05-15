// Spectator-V5는 teamPosition을 주지 않으므로 5명을 5개 라인에 배정해야 한다.
// 다단계 매칭으로 비주류 픽 안정성을 높임:
//   1) 스마이트 보유자 → JUNGLE (확정)
//   2) Marksman tag 보유자 → ADC (1명이면 확정, 2명이면 점수 높은 쪽)
//   3) Support tag 보유자 → SUPPORT (1명이면 확정, 2명이면 점수 높은 쪽)
//   4) 남은 챔프 2명을 MID vs TOP 점수로 매칭
//
// 비주류 픽(탑샤코, 미드룰루, 바텀야스오 등)이 있어도 ADC/SUP만 정상이면
// 나머지 2명만 swap하면 됨. 사용자 수정 부담 최소화.

import { CHAMPIONS, LANES, type Lane } from "@/lib/champions";

type ChampMeta = (typeof CHAMPIONS)[number];

const championByKey = new Map(CHAMPIONS.map((c) => [c.key, c]));
const championById = new Map(CHAMPIONS.map((c) => [c.id, c]));

// MID/TOP 점수: 같은 챔프가 양쪽 다 가능할 때 어느 쪽이 더 자연스러운지
const midScore = (c: ChampMeta): number => {
  const t = c.tags;
  let s = 0;
  if (t.includes("Mage")) s += 5;
  if (t.includes("Assassin")) s += 5;
  if (t.includes("Marksman")) s -= 3;
  if (t.includes("Support")) s -= 5;
  return s;
};

const topScore = (c: ChampMeta): number => {
  const t = c.tags;
  let s = 0;
  if (t.includes("Fighter")) s += 5;
  if (t.includes("Tank")) s += 4;
  if (t.includes("Mage")) s += 1; // 럼블/블라디 등
  if (t.includes("Marksman")) s -= 10;
  if (t.includes("Support")) s -= 5;
  return s;
};

const SMITE = 11;

type RawParticipant = {
  championId: number;
  spell1Id: number;
  spell2Id: number;
  puuid?: string;
};

const hasSmite = (p: RawParticipant) =>
  p.spell1Id === SMITE || p.spell2Id === SMITE;

type TeamPick = { championKey: string; lane: Lane };

export const inferTeamLanes = (
  participants: RawParticipant[],
  _myPuuid?: string,
): TeamPick[] => {
  if (participants.length !== 5) {
    throw new Error(`팀 인원이 5명이 아닙니다: ${participants.length}`);
  }

  const enriched = participants.map((p) => {
    const meta = championById.get(p.championId);
    if (!meta) throw new Error(`Unknown championId: ${p.championId}`);
    return { meta, raw: p };
  });

  const assigned: Partial<Record<Lane, ChampMeta>> = {};
  const remaining = new Set(enriched);

  // ---- 1단계: 스마이트 → JUNGLE ----
  const jungler = [...remaining].find((e) => hasSmite(e.raw));
  if (jungler) {
    assigned.JUNGLE = jungler.meta;
    remaining.delete(jungler);
  }

  // ---- 2단계: Marksman tag → ADC ----
  const marksmen = [...remaining].filter((e) =>
    e.meta.tags.includes("Marksman"),
  );
  if (marksmen.length === 1) {
    assigned.ADC = marksmen[0].meta;
    remaining.delete(marksmen[0]);
  } else if (marksmen.length >= 2) {
    // 둘 중 더 ADC다운 챔프 (점수 높은 쪽). 단순화: info.attack 우선
    marksmen.sort((a, b) => b.meta.info.attack - a.meta.info.attack);
    assigned.ADC = marksmen[0].meta;
    remaining.delete(marksmen[0]);
  }

  // ---- 3단계: Support tag → SUPPORT ----
  const supports = [...remaining].filter((e) =>
    e.meta.tags.includes("Support"),
  );
  if (supports.length === 1) {
    assigned.SUPPORT = supports[0].meta;
    remaining.delete(supports[0]);
  } else if (supports.length >= 2) {
    // 둘 중 더 서폿다운 챔프. info.defense + info.magic 합이 큰 쪽
    supports.sort(
      (a, b) =>
        b.meta.info.defense + b.meta.info.magic - (a.meta.info.defense + a.meta.info.magic),
    );
    assigned.SUPPORT = supports[0].meta;
    remaining.delete(supports[0]);
  }

  // ---- 4단계: JUNGLE 미정이면 폴백 (스마이트 없는 비정상 케이스) ----
  if (!assigned.JUNGLE) {
    // 남은 챔프 중 탱크/파이터 우선 (대충 정글다운)
    const fallback = [...remaining].sort((a, b) => {
      const aJg =
        (a.meta.tags.includes("Tank") ? 1 : 0) +
        (a.meta.tags.includes("Fighter") ? 1 : 0);
      const bJg =
        (b.meta.tags.includes("Tank") ? 1 : 0) +
        (b.meta.tags.includes("Fighter") ? 1 : 0);
      return bJg - aJg;
    })[0];
    if (fallback) {
      assigned.JUNGLE = fallback.meta;
      remaining.delete(fallback);
    }
  }

  // ---- 5단계: ADC/SUPPORT 둘 다 미정이면 폴백 ----
  if (!assigned.ADC || !assigned.SUPPORT) {
    // 남은 인원 중 적당히 배정 - 일어나기 어려운 케이스이긴 함
    const leftover = [...remaining];
    if (!assigned.ADC && leftover.length > 0) {
      leftover.sort((a, b) => b.meta.info.attack - a.meta.info.attack);
      const pick = leftover.shift();
      if (pick) {
        assigned.ADC = pick.meta;
        remaining.delete(pick);
      }
    }
    if (!assigned.SUPPORT && remaining.size > 0) {
      const left = [...remaining];
      left.sort(
        (a, b) =>
          b.meta.info.defense + b.meta.info.magic - (a.meta.info.defense + a.meta.info.magic),
      );
      const pick = left[0];
      if (pick) {
        assigned.SUPPORT = pick.meta;
        remaining.delete(pick);
      }
    }
  }

  // ---- 6단계: 남은 2명을 MID vs TOP 매칭 ----
  // 두 챔프 각각의 MID-TOP 차이 점수로 헝가리안 미니 매칭 (2x2)
  // diff = midScore - topScore (양수=미드선호, 음수=탑선호)
  const leftover = [...remaining];
  if (leftover.length >= 2) {
    const [a, b] = leftover;
    const aDiff = midScore(a.meta) - topScore(a.meta);
    const bDiff = midScore(b.meta) - topScore(b.meta);
    // aDiff가 더 크면 a는 MID, b는 TOP
    if (aDiff >= bDiff) {
      assigned.MID = a.meta;
      assigned.TOP = b.meta;
    } else {
      assigned.MID = b.meta;
      assigned.TOP = a.meta;
    }
    remaining.delete(a);
    remaining.delete(b);
  } else if (leftover.length === 1) {
    const c = leftover[0];
    if (!assigned.MID) assigned.MID = c.meta;
    else if (!assigned.TOP) assigned.TOP = c.meta;
    remaining.delete(c);
  }

  // ---- 결과 조립 (LANES 순서대로) ----
  const result: TeamPick[] = LANES.map((lane) => {
    const meta = assigned[lane];
    if (!meta) {
      // 어떤 라인이 비면 남은 챔프로 채움 (이론상 도달하지 않음)
      const fb = [...remaining][0];
      if (!fb) throw new Error(`라인 ${lane} 배정 실패`);
      remaining.delete(fb);
      return { championKey: fb.meta.key, lane };
    }
    return { championKey: meta.key, lane };
  });

  return result;
};

export { championByKey, championById };
