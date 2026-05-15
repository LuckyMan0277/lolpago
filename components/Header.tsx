import Link from "next/link";
import { Swords } from "lucide-react";
import { PATCH } from "@/lib/champions";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 max-w-3xl flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="lolpago 홈"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30 group-hover:bg-primary/20 transition-colors">
            <Swords className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="font-bold text-sm tracking-tight">
            <span className="text-foreground">lol</span>
            <span className="text-primary">pago</span>
          </span>
          <span className="hidden sm:inline ml-1 text-[11px] text-muted-foreground">
            사전 주도권 리포트
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Patch
          </span>
          <span className="text-xs font-mono tabular-nums text-foreground/80">
            {PATCH}
          </span>
        </div>
      </div>
    </header>
  );
}
