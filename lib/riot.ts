// Riot API 클라이언트. KR 서버 기준.

export type RiotPlatform = "kr" | "na1" | "euw1" | "eun1" | "jp1";
export type RiotRegional = "asia" | "americas" | "europe";

const PLATFORM_TO_REGIONAL: Record<RiotPlatform, RiotRegional> = {
  kr: "asia",
  jp1: "asia",
  na1: "americas",
  euw1: "europe",
  eun1: "europe",
};

const KEY = () => {
  const k = process.env.RIOT_API_KEY;
  if (!k) throw new Error("RIOT_API_KEY가 설정되지 않았습니다.");
  return k;
};

const headers = () => ({ "X-Riot-Token": KEY() });

export type Account = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type Participant = {
  puuid: string;
  teamId: 100 | 200;
  championId: number;
  spell1Id: number;
  spell2Id: number;
  riotId?: string;
};

export type CurrentGame = {
  gameId: number;
  gameQueueConfigId: number;
  gameMode: string;
  gameStartTime: number;
  participants: Participant[];
};

const SMITE_SPELL_ID = 11;

export const isSmiteCarrier = (p: Participant) =>
  p.spell1Id === SMITE_SPELL_ID || p.spell2Id === SMITE_SPELL_ID;

export const fetchAccountByRiotId = async (
  gameName: string,
  tagLine: string,
  regional: RiotRegional = "asia",
): Promise<Account> => {
  const url = `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (res.status === 404) throw new RiotError("ACCOUNT_NOT_FOUND", "소환사를 찾을 수 없습니다.");
  if (res.status === 401 || res.status === 403)
    throw new RiotError("AUTH", "Riot API 키가 만료됐거나 권한이 없습니다.");
  if (res.status === 429) throw new RiotError("RATE_LIMIT", "Riot API 요청이 너무 많습니다. 잠시 후 재시도.");
  if (!res.ok) throw new RiotError("UPSTREAM", `Riot Account API 오류: ${res.status}`);
  return res.json();
};

export const fetchCurrentGame = async (
  puuid: string,
  platform: RiotPlatform = "kr",
): Promise<CurrentGame> => {
  const url = `https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (res.status === 404)
    throw new RiotError(
      "NOT_IN_GAME",
      "현재 진행 중인 게임이 없습니다. 픽창 종료 후 로딩 화면부터 시도하세요.",
    );
  if (res.status === 401 || res.status === 403)
    throw new RiotError("AUTH", "Riot API 키가 만료됐거나 권한이 없습니다.");
  if (res.status === 429) throw new RiotError("RATE_LIMIT", "Riot API 요청이 너무 많습니다.");
  if (!res.ok) throw new RiotError("UPSTREAM", `Spectator API 오류: ${res.status}`);
  return res.json();
};

export class RiotError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export { PLATFORM_TO_REGIONAL };
