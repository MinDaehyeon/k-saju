# K-Saju 출시 실행 가이드 (계정 필요한 3가지 — 각 5~10분)

라이브(임시): https://beth-technologies-drawings-purchases.trycloudflare.com

---

## ① 광고 — 지금 바로 게시 (소재 100% 완성)
**비주얼:** `ksaju-share-card.png` (Desktop\claude\ksaju-share-card.png) — 틱톡·인스타·핀터레스트에 그대로 업로드.
**틱톡/릴스 캡션(복붙):**
> Your Western zodiac is basic. Korea reads the exact HOUR you were born 🇰🇷🔮 I got my Korean name too 😭 try yours (free, link in bio) #saju #korean #astrology #fyp #kdrama #fortune #koreanname #tarot #zodiac #palmreading
**영상:** `LAUNCH.md`의 스크립트 A/B/C 중 하나로 화면녹화(라이브 URL 띄워서 생일 입력→결과). 30초 내, K-pop 트렌딩 사운드.
**댓글 유도:** "comment your birthday + I'll tell you your element 👀" → 답글로 미니 리딩 + 링크(인게이지먼트↑).

## ② 영구 배포 (GitHub → Render) — 임시 URL을 진짜 주소로
1. github.com/new → 빈 repo 생성 (이름: `k-saju`, README 체크 해제)
2. 이 폴더에서 터미널(또는 GitHub Desktop으로 이 폴더 Publish):
   ```
   cd C:\Users\mdhyu\Desktop\claude\k-saju
   & "C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/<당신아이디>/k-saju.git
   & "C:\Program Files\Git\cmd\git.exe" push -u origin master
   ```
   (push 때 GitHub 로그인 1회 — 그게 제가 못 한 단계)
3. render.com → New → **Blueprint** → 그 repo 선택(`render.yaml` 자동 인식) → 유료플랜(영속 디스크) → Deploy
4. Render 환경변수에 `GEMINI_API_KEY`(풍부화), `KSAJU_SECRET`(자동), 결제 켤 거면 ③의 키들.
→ `https://k-saju.onrender.com` 같은 **영구 주소** 생성. (그 후 trycloudflare 터널은 꺼도 됨)

## ③ 실결제 (Lemon Squeezy) — 키만 꽂으면 라이브
*코드·웹훅 검증 끝(6/6). 사장님은 가맹·상품만.*
1. lemonsqueezy.com 가입(사업자/개인) → Store 생성
2. Products → 모듈별 상품 생성(또는 단일):
   - Core $4.99 / 2026 Monthly $3.99 / Life Map $4.99 / Love $2.99 / Palm $2.99
   - 각 상품의 **Variant ID** 메모
3. Settings → API → **API key** 발급, **Store ID** 확인
4. Settings → Webhooks → URL `https://<배포주소>/api/webhook`, events: `order_created`(+`order_refunded`), **Signing secret** 메모
5. Render env에 입력:
   ```
   PAYMENT_MODE=live
   LEMONSQUEEZY_API_KEY=...
   LEMONSQUEEZY_STORE_ID=...
   LEMONSQUEEZY_WEBHOOK_SECRET=...
   LS_VARIANT_CORE=...
   LS_VARIANT_MONTHLY_2026=...
   LS_VARIANT_DAEUN_LIFE=...
   LS_VARIANT_LOVE_DEEP=...
   LS_VARIANT_PALM=...
   PUBLIC_URL=https://<배포주소>
   ```
→ 그 순간부터 **진짜 돈**이 들어옵니다(테스트 스텁 자동 해제).

## (선택) ④ 풍부화 안정화
지금 Gemini 무료등급이 자주 과부하 → Anthropic에 소액 충전하면 코드가 자동 우선 전환(더 깊고 안정).
