# 모바일 앱 빌드 가이드

`lolpago` 웹앱을 Capacitor로 래핑해 iOS / Android 네이티브 앱으로 빌드한다.

## 아키텍처

- **앱**: Next.js를 정적 export(`out/`)한 SPA를 네이티브 셸(WebView)에 번들
- **백엔드**: API 라우트(`app/api/**`)는 Vercel에 배포된 그대로 사용. 앱은 `NEXT_PUBLIC_API_BASE`로 호출
- **빌드 분기**: `BUILD_TARGET=mobile`일 때만 `output: 'export'` 적용 (`next.config.ts` 참고)
- **API 라우트 분리**: `scripts/build-mobile.mjs`가 빌드 시 `app/api`를 `.api-stash/`로 임시 이동한 뒤 무조건 복원

## 사전 준비

- Node.js 20+
- Android: JDK 21 + Android Studio (또는 Android SDK)
- iOS: macOS + Xcode 15+ + CocoaPods. **Windows에서는 로컬 iOS 빌드 불가** → GitHub Actions 사용

## 로컬 개발 흐름

```bash
# 1) 환경변수 설정 (.env.local)
echo "NEXT_PUBLIC_API_BASE=https://your-app.vercel.app" >> .env.local

# 2) 모바일 정적 빌드 + Capacitor sync
npm run cap:sync

# 3) Android Studio 열기
npm run cap:open:android

# 4) (Mac에서만) Xcode 열기
npm run cap:open:ios
```

`out/` 디렉토리는 git에 들어가지 않는다. 빌드할 때마다 새로 생성된다.

## iOS 플랫폼 최초 추가

Mac에서:

```bash
npm run build:mobile
npx cap add ios
cd ios/App && pod install
```

`ios/` 디렉토리는 커밋해두면 다음부터 `cap add`를 안 해도 된다.

## CI에서 빌드

- **Android**: `.github/workflows/android-build.yml` — ubuntu runner에서 debug APK 산출
- **iOS**: `.github/workflows/ios-build.yml` — macOS-14 runner에서 unsigned simulator .app 산출

둘 다 `workflow_dispatch`로 수동 실행하면서 `api_base` 입력으로 백엔드 URL을 지정할 수 있다.

## App Store / Play Store 출시

위 workflow는 **빌드 검증용**(unsigned). 실제 스토어 제출은 별도 작업 필요:

- **Play Store**: `assembleRelease` + keystore 서명. `android/app/build.gradle`의 `signingConfigs`에 secrets 주입
- **App Store**: 애플 개발자 계정 + 인증서 + 프로비저닝 프로파일. fastlane 또는 EAS Submit 같은 도구 권장

## 디버깅 팁

- WebView 콘솔 보기: Android는 Chrome에서 `chrome://inspect`, iOS는 Safari → Develop → 시뮬레이터
- 정적 빌드가 깨질 때: `.api-stash/`가 남아있는지 확인하고 수동으로 `app/api`로 되돌릴 것
- `redirect()` 등 SSR 한정 기능이 새로 추가되면 mobile 빌드가 깨질 수 있음. 클라이언트 컴포넌트에서 `useRouter().replace()`로 대체.
