// LLM 응답에서 JSON 객체 추출. 코드 펜스가 섞여 있어도 처리.
export const extractJson = (text: string): unknown => {
  const trimmed = text.trim();

  // 1) 그대로 JSON 파싱 시도
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2) 코드 펜스 안의 JSON 시도
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  // 3) 첫 { 부터 마지막 } 까지 슬라이스해서 시도
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {}
  }

  throw new Error("Failed to extract JSON from LLM response.");
};
