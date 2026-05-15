import Link from "next/link";
import {
  ArrowRight,
  Target,
  Sparkles,
  Map,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Target,
    title: "라인별 주도권",
    desc: "초반·중반·후반 매치업, 선 2렙, 갱 취약도까지 한눈에.",
  },
  {
    icon: Sparkles,
    title: "내 챔피언 가이드",
    desc: "이번 판 한정 내 역할, 싸워야 할 때와 피해야 할 상황.",
  },
  {
    icon: Map,
    title: "정글 동선 · 운영",
    desc: "시작 캠프부터 첫 갱 우선순위, 시간대별 액션까지.",
  },
  {
    icon: Clock,
    title: "한 줄 오더 3줄",
    desc: "게임 직전 팀원에게 외칠 핵심 3줄. 60초 안에 읽힘.",
  },
];

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-10 sm:py-16 max-w-2xl">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <ShieldAlert className="h-3 w-3" />
          승률 예측이 아닌 행동 추천
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15]">
          픽창 직후,
          <br />
          <span className="bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            이 판을 어떻게 풀어야 하는지
          </span>
          <br />
          알려줍니다.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md mx-auto pt-1">
          양 팀 10명 챔피언을 입력하면 라인별 주도권·정글 동선·상대법·한 줄
          오더까지 약 1분 안에 코치 리포트가 만들어집니다.
        </p>
      </div>

      <div className="my-10">
        <Link
          href="/"
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full h-14 text-base font-semibold cta-glow",
          )}
        >
          리포트 만들러 가기
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">자주 묻는 질문</h2>
        <Faq
          q="다른 전적 검색 사이트와 뭐가 달라요?"
          a="OP.GG·데샤는 챔피언 단위 승률을 보여줍니다. 이 서비스는 '이번 한 판에서 너는 무엇을 해야 하는가'를 알려주는 코칭 리포트입니다."
        />
        <Faq
          q="자동 로딩은 언제 동작해요?"
          a="픽창 종료 후 로딩 화면이 뜨면 그 시점부터 Riot Spectator API로 현재 게임을 가져올 수 있습니다. 픽창 도중에는 동작하지 않습니다."
        />
        <Faq
          q="라인 추정이 가끔 틀려요."
          a="비주류 픽(탑샤코, 미드룰루 등)은 자동 추정의 한계입니다. 챔피언 카드를 드래그해서 다른 라인과 swap할 수 있습니다."
        />
        <Faq
          q="리포트 생성에 1분 정도 걸리는 이유?"
          a="Claude Opus 4.7이 라인 매치업·내 챔피언·상대법·운영을 모두 작성하기 때문에 평균 50~60초 걸립니다."
        />
      </section>

      <p className="mt-10 text-center text-[11px] text-muted-foreground/70">
        Riot Games is not affiliated with this site. Data: Riot Data Dragon.
      </p>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Target;
  title: string;
  desc: string;
}) {
  return (
    <Card className="group card-interactive">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25 group-hover:bg-primary/18 transition-colors">
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-sm mb-1">{title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {desc}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <Card className="card-interactive">
      <CardContent className="pt-4 pb-4 space-y-1">
        <div className="text-sm font-medium">{q}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">{a}</div>
      </CardContent>
    </Card>
  );
}
