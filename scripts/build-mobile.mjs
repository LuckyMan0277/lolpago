// 모바일 정적 export 빌드.
// app/api 디렉토리는 POST 라우트 핸들러를 가지고 있어 next export가 거부한다.
// 빌드 동안 임시로 이동했다가 무조건 복원한다.
import { spawn } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const apiDir = join(root, "app", "api");
const stashDir = join(root, ".api-stash");

let moved = false;

const restore = () => {
  if (moved && existsSync(stashDir)) {
    renameSync(stashDir, apiDir);
    moved = false;
    console.log("[build-mobile] app/api 복원 완료");
  }
};

process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});

try {
  if (existsSync(stashDir)) {
    console.error(
      "[build-mobile] .api-stash가 이미 존재합니다. 이전 빌드가 비정상 종료된 것 같습니다. 수동으로 .api-stash를 app/api로 되돌린 뒤 다시 실행하세요.",
    );
    process.exit(1);
  }

  if (existsSync(apiDir)) {
    renameSync(apiDir, stashDir);
    moved = true;
    console.log("[build-mobile] app/api → .api-stash 이동");
  }

  // 이전 빌드의 캐시된 라우트 타입이 남아 ts 검증을 깨뜨림
  const nextCache = join(root, ".next");
  if (existsSync(nextCache)) {
    rmSync(nextCache, { recursive: true, force: true });
    console.log("[build-mobile] .next 캐시 제거");
  }

  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const env = { ...process.env, BUILD_TARGET: "mobile" };

  const code = await new Promise((resolve) => {
    const child = spawn(cmd, ["next", "build"], {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });
    child.on("close", resolve);
  });

  restore();
  process.exit(code ?? 0);
} catch (err) {
  console.error("[build-mobile] 빌드 실패:", err);
  restore();
  process.exit(1);
}
