import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchAccountByRiotId,
  fetchCurrentGame,
  RiotError,
  type Participant,
} from "@/lib/riot";
import { inferTeamLanes } from "@/lib/lane-inference";
import { PATCH } from "@/lib/champions";

export const runtime = "nodejs";
export const maxDuration = 15;

const InputSchema = z.object({
  riotId: z.string().min(3).describe("예: '히든 온 부쉬#KR1'"),
});

const splitRiotId = (riotId: string) => {
  const idx = riotId.lastIndexOf("#");
  if (idx === -1 || idx === 0 || idx === riotId.length - 1) {
    return null;
  }
  return {
    gameName: riotId.slice(0, idx).trim(),
    tagLine: riotId.slice(idx + 1).trim(),
  };
};

export async function POST(req: Request) {
  let body: { riotId: string };
  try {
    body = InputSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "INVALID_INPUT", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const parts = splitRiotId(body.riotId);
  if (!parts) {
    return NextResponse.json(
      {
        error: "INVALID_RIOT_ID",
        detail: "Riot ID 형식이 잘못됐습니다. 예: '소환사명#KR1'",
      },
      { status: 400 },
    );
  }

  try {
    const account = await fetchAccountByRiotId(parts.gameName, parts.tagLine, "asia");
    const game = await fetchCurrentGame(account.puuid, "kr");

    const blueParticipants = game.participants.filter((p) => p.teamId === 100);
    const redParticipants = game.participants.filter((p) => p.teamId === 200);

    if (blueParticipants.length !== 5 || redParticipants.length !== 5) {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_GAME",
          detail: "5v5 게임이 아닙니다. 솔로/자유 랭크 또는 일반 게임만 지원합니다.",
        },
        { status: 400 },
      );
    }

    // 내가 어느 팀인지부터 결정
    const meOnBlue = blueParticipants.find(
      (p: Participant) => p.puuid === account.puuid,
    );
    const meOnRed = redParticipants.find(
      (p: Participant) => p.puuid === account.puuid,
    );
    if (!meOnBlue && !meOnRed) {
      return NextResponse.json(
        { error: "NOT_PARTICIPANT", detail: "현재 게임에 해당 소환사가 포함돼있지 않습니다." },
        { status: 404 },
      );
    }
    const myParticipants = meOnBlue ? blueParticipants : redParticipants;
    const enemyParticipants = meOnBlue ? redParticipants : blueParticipants;
    const mySide: "BLUE" | "RED" = meOnBlue ? "BLUE" : "RED";

    // 내 팀과 적 팀 각각 라인 추정 (UI에서 "우리 팀"=내 팀, "상대 팀"=적 팀이 되도록 미리 swap)
    const myTeam = inferTeamLanes(myParticipants, account.puuid);
    const enemyTeam = inferTeamLanes(enemyParticipants);

    // 내 라인은 내 puuid의 챔피언이 들어간 슬롯의 lane
    const meParticipant = meOnBlue ?? meOnRed!;
    const myPickInfo = myTeam.find((p) =>
      participantHasChampion(meParticipant, p.championKey),
    );
    const myLane = myPickInfo?.lane ?? null;

    return NextResponse.json({
      patch: PATCH,
      gameMode: game.gameMode,
      queueId: game.gameQueueConfigId,
      gameStartTime: game.gameStartTime,
      mySide,
      myTeam,
      enemyTeam,
      myLane,
      gameName: account.gameName,
      tagLine: account.tagLine,
    });
  } catch (err) {
    if (err instanceof RiotError) {
      const status =
        err.code === "ACCOUNT_NOT_FOUND" || err.code === "NOT_IN_GAME"
          ? 404
          : err.code === "AUTH"
            ? 401
            : err.code === "RATE_LIMIT"
              ? 429
              : 502;
      return NextResponse.json(
        { error: err.code, detail: err.message },
        { status },
      );
    }
    console.error("[/api/load-game] unexpected error:", err);
    return NextResponse.json(
      { error: "INTERNAL", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// 챔피언 키 매칭용 helper
import { championById } from "@/lib/lane-inference";

function participantHasChampion(p: Participant, championKey: string): boolean {
  const c = championById.get(p.championId);
  return c?.key === championKey;
}
