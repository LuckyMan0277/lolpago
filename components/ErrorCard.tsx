import { AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ErrorCard({
  title = "오류가 발생했습니다",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-rose-500/40 bg-gradient-to-br from-rose-500/10 to-rose-500/5">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30">
            <AlertOctagon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-sm font-semibold text-rose-200">{title}</div>
            {detail && (
              <div className="text-xs text-rose-300/80 leading-relaxed break-words">
                {detail}
              </div>
            )}
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-2 border-rose-500/40 text-rose-200 hover:bg-rose-500/15 hover:text-rose-100"
              >
                다시 시도
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
