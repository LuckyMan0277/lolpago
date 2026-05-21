import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "lolpago · 사전 주도권 리포트",
  description:
    "픽창에서 10명 챔피언을 입력하면 이 판을 어떻게 플레이할지 코치가 알려줍니다.",
};

// viewport-fit=cover로 다이나믹 아일랜드/노치/홈 인디케이터까지 webview 확장
// env(safe-area-inset-*)가 활성화되어 globals.css/Header에서 사용 가능
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col app-bg pb-[env(safe-area-inset-bottom)]">
        <Header />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
