// 단일 팀(5명) 운영 전략 생성 프롬프트.
// 상대 팀을 모른 채 이 팀 자체의 정체성을 분석한다 (캐시 대상이라 컨텍스트 독립).

const TEAM_STRATEGY_JSON_TEMPLATE = `{
  "composition_summary": "팀 5명 요약 한 줄 (예: '말파-사일러스-나피리-애쉬-룰루 정면 한타 조합')",
  "operation_main": "SPLIT_PUSH | TEAMFIGHT | PICK_OFF | POKE_SIEGE | DIVE_SNOWBALL | LATE_SCALING | GLOBAL_PRESSURE | COUNTER_ENGAGE",
  "operation_sub": null,
  "style": "팀 운영 스타일 한 문장",
  "strengths": ["강점1", "강점2"],          // 2~4개, 각 14자 이내
  "weaknesses": ["약점1", "약점2"],          // 2~4개, 각 14자 이내
  "win_formula": "이 팀이 이기는 그림을 한 문장 60자 이내로. 핵심 트리거→결과만 (예: '말파 R로 적 묶고 룰루가 애쉬 보호해 정면 한타')",
  "team_triggers": [
    {
      "champion": "한글 챔피언명 (이 팀 5명 중 하나)",
      "when": "이 챔피언이 만드는 신호/조건 1문장",
      "team_does": "팀 즉시 행동 1-2문장"
    }
    // 2~4개
  ],
  "power_curve": { "early": 3, "mid": 4, "late": 5 },  // 1~5
  "ideal_scenario": "이 팀이 가장 빛나는 시나리오 1문장",
  "collapse_scenario": "이 팀이 무너지는 시나리오 1문장"
}`;

export const TEAM_STRATEGY_SYSTEM = `당신은 리그 오브 레전드(LoL)의 시니어 팀 운영 코치다.
**한 팀(5명)의 조합만 보고** 그 팀의 운영 정체성·승리 공식·트리거를 분석한다. 상대 팀은 모른다는 전제.

# 출력 본질
- 챔피언 설명 금지 ("X는 탱커입니다"). 트리거-반응 규칙 형태로 써라.
- 이 팀이 가장 잘 하는 게임 그림이 무엇인가? 어떻게 이기는가?
- "왜"보다 "무엇을 해야 하는가"가 먼저.

# 8가지 팀 운영 유형 (반드시 이 중에서)
- SPLIT_PUSH: 사이드 압박/인원 분산
- TEAMFIGHT: 좁은 지형 정면 한타
- PICK_OFF: 시야+CC 연계로 한 명 끊기
- POKE_SIEGE: 견제로 체력 깎고 오브젝트
- DIVE_SNOWBALL: 초반 주도권 → 다이브/포탑
- LATE_SCALING: 죽지 않고 16렙·3코어 도달
- GLOBAL_PRESSURE: 궁극기로 인원수 차이
- COUNTER_ENGAGE: 받아치기

주 운영(operation_main) 1개 필수, 보조(operation_sub) 명확할 때만 (애매하면 null).

# power_curve 가이드
- 1: 매우 약함  2: 약함  3: 보통  4: 강함  5: 매우 강함
- 팀 평균이 아니라 "팀 운영 가능 강도" 기준.
- 예: 케일/카사딘/징크스 = early 1, mid 3, late 5

# 트리거 작성
- 각 트리거 = { 챔피언 1명 + 조건 + 팀 반응 }
- 이 팀에 실제로 있는 챔피언 이름만.
- 우리 팀 시점으로 작성 (적이 무엇을 하느냐는 다음 단계에서 합성).

# win_formula 작성 (중요)
- **한 문장, 60자 이내**. 핵심 트리거 → 결과만.
- 누가-무엇-어떻게의 인과를 한 흐름으로 압축.
- 좋은 예: "말파 R로 적 묶고 룰루가 애쉬 키워서 정면 한타 압살."
- 나쁜 예: "이 팀은 한타가 강하기 때문에 좋은 조건에서 싸우면 이길 수 있고, 또한..."

# 출력 형식
- raw JSON만. 코드 펜스 금지. 첫 글자 '{'.
- enum 값 정확히 사용.
- 모든 필드 채움.

# 출력 JSON 템플릿
${TEAM_STRATEGY_JSON_TEMPLATE}`;

type ChampionNote = {
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
};

const formatPowerCurve = (p?: { early: number; mid: number; late: number }) => {
  if (!p) return null;
  const bars = ["▁", "▂", "▃", "▄", "▅"];
  const b = (n: number) => bars[Math.max(0, Math.min(4, n - 1))];
  return `초반 ${b(p.early)}${p.early} → 중반 ${b(p.mid)}${p.mid} → 후반 ${b(p.late)}${p.late}`;
};

export const buildTeamStrategyUserPrompt = (input: {
  patch: string;
  picks: Array<{ championName: string; lane: string }>;
  championNotes: ChampionNote[];
}) => {
  const lines: string[] = [
    `# 팀 정보`,
    `- 패치: ${input.patch}`,
    ``,
    `# 이 팀 5명 (라인 / 챔피언)`,
    ...input.picks.map((p) => `- ${p.lane}: ${p.championName}`),
    ``,
    `# 챔피언 사전분석 (스킬 + 강점·약점·파워커브)`,
    ``,
  ];

  for (const c of input.championNotes) {
    const tags = c.tags?.length ? ` [${c.tags.join("/")}]` : "";
    lines.push(`## ${c.championName}${tags}`);
    if (c.identity) lines.push(`  - 정체성: ${c.identity}`);
    const pc = formatPowerCurve(c.power);
    if (pc) lines.push(`  - 파워커브: ${pc}`);
    if (c.power_window) lines.push(`  - 파워창: ${c.power_window}`);
    if (c.damage_type) lines.push(`  - 피해타입: ${c.damage_type}`);
    if (c.powerspikes?.length)
      lines.push(`  - 파워스파이크: ${c.powerspikes.join(" / ")}`);
    if (c.strengths?.length)
      lines.push(`  - 챔프 강점: ${c.strengths.join(" / ")}`);
    if (c.weaknesses?.length)
      lines.push(`  - 챔프 약점: ${c.weaknesses.join(" / ")}`);
    if (c.passive) lines.push(`  - ${c.passive}`);
    if (c.Q) lines.push(`  - ${c.Q}`);
    if (c.W) lines.push(`  - ${c.W}`);
    if (c.E) lines.push(`  - ${c.E}`);
    if (c.R) lines.push(`  - ${c.R}`);
    lines.push(``);
  }

  lines.push(
    `# 작업`,
    `이 팀 5명이 만들어내는 운영 정체성·승리 공식·트리거를 JSON으로 정리하라.`,
    `상대 팀은 모른다는 전제로, 이 팀 자체의 강점/약점/이상 시나리오 중심.`,
    `반드시 raw JSON만. 첫 글자는 '{'.`,
  );
  return lines.join("\n");
};
