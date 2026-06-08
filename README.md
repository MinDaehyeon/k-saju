# K-Saju — Korean Star Reading (MVP v3)

영어권 대상 "K-Saju" 운세 SaaS. **진짜 만세력(사주)은 결정론적 계산**, 운세 해석을 명리 규칙으로 엮고 **LLM으로 풍부화**. 결제 후 **영구 매직링크로 언제든 재열람**, 운세를 **모듈(코어+애드온)로 분리해 개별 판매(업셀)**.

## 무엇이 동작하나 (자동 테스트 통과)
- **엔진 18/18** (`saju.test.ts`): 일주 앵커 2000-01-01=戊午, 입춘 경계, 오호둔/오서둔, 진태양시, 대운/지장간/신강신약, 결정론.
- **풍부화** (`enrich.test.ts`): Gemini로 실제 호출 — 결정론 사실을 *안 바꾸고* 깊게 산문화.
- **모듈형 E2E 18/18** (`e2e_v3.ts`): 결제→영구링크→이름선택→코어(풍부화·캐시)→애드온 잠금/해금/열람→재열람 동일→정적유출 차단→/my 열거 차단.
- **UI**: 퍼널(app.html)→/r/:id 대시보드(모듈 그리드, 잠금/해금, 개별 열람) Playwright 확인.

## 실행
```
cd k-saju
PORT=8912 bun server.ts          # http://localhost:8912 (.env의 GEMINI_API_KEY 자동 로드 → 풍부화 ON)
bun saju.test.ts                 # 엔진
bun enrich.test.ts               # 풍부화(키 필요)
bun e2e_v3.ts                    # 모듈형 전 흐름(서버 켠 상태)
```

## 구조
| 파일 | 역할 |
|---|---|
| `saju.ts` | 만세력 엔진(결정론) — 사주팔자·오행·십성·지장간·신강신약·대운 |
| `reading.ts` | 코어 해석(사주+운세) — 십성·일지·2026세운 규칙, XSS escape |
| `modules.ts` | **모듈 카탈로그**: core + 애드온(2026월별·평생대운·연애심화) |
| `enrich.ts` | LLM 풍부화(Anthropic→Gemini 폴백) — 사실 보존, 캐시 |
| `db.ts` | SQLite 영구저장: readings·entitlements·module_cache·events |
| `server.ts` | API: 티저·체크아웃·`/r/:id`·모듈 해금/열람·웹훅(HMAC)·정적 allowlist |
| `app.html` / `reading.html` | 퍼널 / 재열람 대시보드(모듈 업셀·🔊이름 듣기) |

## 결제 후 흐름 (전문가 구성)
1. 무료 티저(`/api/saju/teaser`) → 2. 결제(`/api/checkout`) → **영구링크 `/r/:id` 생성·저장**
3. `/r/:id` 대시보드: 한국이름 선택 → 코어 리딩(풍부화, **캐시로 재열람 동일**)
4. 애드온은 **잠금 → 개별 결제 해금 → 별도 열람**(각각 가격) = 업셀
5. 링크 북마크/공유로 **언제든 재방문**. (이메일 매직링크는 Resend 키 연결 시)

## 환경변수
`GEMINI_API_KEY`(풍부화) · `ANTHROPIC_API_KEY`(선택, 우선) · `KSAJU_SECRET` · `PAYMENT_MODE=test|live`
라이브 결제: `LEMONSQUEEZY_API_KEY/_STORE_ID/_VARIANT_ID/_WEBHOOK_SECRET` · 이메일: `RESEND_API_KEY` · DB: `KSAJU_DB`

## 배포 (B)
Docker + Render: repo를 GitHub에 올리고 Render → Blueprint(`render.yaml`). 영속 디스크에 SQLite(`/app/data`). 서버리스(Vercel)는 파일DB 휘발 → Turso/libSQL/Postgres 권장.

## ⚠ 라이브 결제 켜기 전 체크리스트 (Codex high-effort 리뷰)
- [x] 정적 allowlist (DB/소스/.env 노출 차단) — **반영됨**
- [x] LLM/이름 출력 sanitize(저장 XSS) — **반영됨**
- [x] `/api/my` 이메일 열거 차단 — **반영됨**
- [x] PAYMENT_MODE 명시(프로덕션 무료 grant 사고 방지) — **반영됨**
- [x] 이름 변경 시 module_cache 무효화 · 웹훅 멱등(grant 후 mark) — **반영됨**
- [ ] **module별 Lemon variant/가격 매핑** (지금 단일 variant)
- [ ] **checkout_intents·orders·order_items** 테이블 + 트랜잭션 grant
- [ ] 웹훅 `X-Event-Name/status/store/variant/amount/currency/refund` 전수 검증 + `order_refunded` revoke
- [ ] `/api/my` 일회용 이메일 인증(Resend) 후 목록 제공
- [ ] **풍부화 비동기화**(결제/이름선택 직후 프리워밍·잡큐, 첫 열람 15~40s 블록 제거)
- [ ] cache key에 model/prompt version 포함 · provider timeout/cost cap
- [ ] rate limit(`/checkout`,`/teaser`,`/module/*`) · body size 제한

## 정확도 한계(정직)
절기 Meeus 저정밀(±수분)·진태양시 자정경계(조자시 학파 고정)·음력 미지원·격국/용신 미반영·손금(D) 미구현(카탈로그 예정). 신강신약/대운은 휴리스틱.
