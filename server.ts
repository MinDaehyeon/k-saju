// ============================================================
// K-Saju MVP server v3 — 모듈형 + 영구저장 + 재열람 + LLM 풍부화 캐시
//  무료: /api/saju/teaser
//  구매: /api/checkout {module:'core'|애드온, readingId?} → 영구링크 /r/:id
//  열람: /r/:id (대시보드) · /api/reading/:id · /api/reading/:id/module/:m (해금 게이트)
//  결제: Lemon Squeezy webhook(HMAC) → 엔틀먼트 부여 (TEST 모드는 즉시 부여)
//  재방문: /api/my?email= (이메일로 내 리딩 목록 — Resend 키 있으면 메일발송 가능)
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import { computeSaju, ANIMALS, ANIMAL_EMOJI, ELEM_EN, ELEM_CN, BRANCHES } from "./saju.ts";
import { buildReading } from "./reading.ts";
import { generateNames } from "./names.ts";
import { CATALOG, META, buildModule, PALM_PROMPT } from "./modules.ts";
import { enrichReading, enrichVision, factsText, enrichEnabled } from "./enrich.ts";
import { computeCompat, bestIdols } from "./compat.ts";
import * as db from "./db.ts";

const IDOLS:any[] = await Bun.file(import.meta.dir+"/idols.json").json(); // K-pop 아이돌 DB(사주 사전계산)

const DIR=import.meta.dir;
const PORT=Number(process.env.PORT||8912);
const LS_KEY=process.env.LEMONSQUEEZY_API_KEY, LS_VARIANT=process.env.LEMONSQUEEZY_VARIANT_ID, LS_STORE=process.env.LEMONSQUEEZY_STORE_ID;
const WEBHOOK_SECRET=process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const LIVE_READY=!!(LS_KEY&&LS_VARIANT&&LS_STORE);
// PAYMENT_MODE 명시 우선(프로덕션 env 누락으로 무료 grant 되는 사고 방지)
const TEST_MODE = process.env.PAYMENT_MODE ? process.env.PAYMENT_MODE!=="live" : !LIVE_READY;

class BadInput extends Error{}
const json=(o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json"}});
// LLM/저장 출력에서 <b> 외 모든 태그 제거 (저장 XSS/prompt-injection 방어)
const sanitize=(s:string)=>String(s).replace(/<(?!\/?b\s*>)[^>]*>/gi,"");
function intIn(v:any,lo:number,hi:number,n:string){const x=Number(v);if(!Number.isInteger(x)||x<lo||x>hi)throw new BadInput(`bad ${n}`);return x;}
const dim=(y:number,m:number)=>new Date(y,m,0).getDate();
function validate(o:any){
  const year=intIn(o.y,1900,2100,"year"),month=intIn(o.m,1,12,"month"),day=intIn(o.d,1,dim(year,month),"day");
  const hour=(o.h===""||o.h==null)?12:intIn(o.h,0,23,"hour"), minute=(o.min===""||o.min==null)?0:intIn(o.min,0,59,"minute");
  const gender=(o.g==="M"||o.g==="F")?o.g:undefined;
  const name=String(o.name??"You").slice(0,40), email=o.email?String(o.email).slice(0,120):null;
  return {b:{year,month,day,hour,minute,gender}, name, email};
}
function chartCommon(c:any){return {
  pillars:{year:c.year.gz,month:c.month.gz,day:c.day.gz,hour:c.hour?.gz,yearKR:c.year.gzKR,dayKR:c.day.gzKR},
  dayMaster:{cn:ELEM_CN[c.dayMasterElem],en:ELEM_EN[c.dayMasterElem]},
  zodiac:{animal:ANIMALS[c.zodiac],emoji:ANIMAL_EMOJI[c.zodiac],branch:BRANCHES[c.zodiac]},
  elements:c.elements, strength:c.strength.verdict, meta:c.meta};
}
function teaserPayload(b:any,name:string){
  const c=computeSaju(b); const r=buildReading(c,{name});
  const x=chartCommon(c); return {pillars:x.pillars,dayMaster:x.dayMaster,zodiac:x.zodiac,reading:{overview:r.overview}};
}

// 모듈 콘텐츠 빌드 + 풍부화 + 캐시 (재열람 동일 보장)
async function moduleContent(id:string, mod:string){
  const cached=db.getModuleCache(id,mod); if(cached) return cached;
  const row=db.getReading(id)!; const birth=JSON.parse(row.birth_json);
  const c=computeSaju(birth);
  const base=buildReading(c,{name:birth.name,koreanName:row.korean_name||undefined,gender:birth.gender});
  const content:any=buildModule(mod,c,base,{gender:birth.gender});
  const map=Object.fromEntries(content.sections.map((s:any,i:number)=>["s"+i,s]));
  const enr=await enrichReading(factsText(c),map,{name:birth.name,koreanName:row.korean_name||undefined});
  if(enr){ content.sections=content.sections.map((s:any,i:number)=>({...s,body:sanitize(enr["s"+i]||s.body)})); content.enriched=true; }
  db.setModuleCache(id,mod,content); return content;
}
// C: 비동기 프리워밍 — 결제/이름선택 직후 백그라운드로 풍부화 미리 굽기(첫 열람 즉시화)
const inFlight=new Set<string>();
function prewarm(id:string, mod:string){
  if(mod==="palm") return; // 손금은 사진 필요 → 프리워밍 X
  const k=id+":"+mod; if(db.getModuleCache(id,mod)||inFlight.has(k)) return;
  inFlight.add(k); moduleContent(id,mod).catch(e=>console.error("[prewarm]",e)).finally(()=>inFlight.delete(k));
}
// D: 모듈별 Lemon variant (없으면 기본). 라이브에서 LS_VARIANT_CORE / _MONTHLY_2026 ... 로 설정
const moduleVariant=(id:string)=>process.env["LS_VARIANT_"+id.toUpperCase()]||LS_VARIANT;

async function lemonCheckout(custom:Record<string,string>, variantId:string):Promise<string>{
  const res=await fetch("https://api.lemonsqueezy.com/v1/checkouts",{method:"POST",
    headers:{Authorization:`Bearer ${LS_KEY}`,"Content-Type":"application/vnd.api+json",Accept:"application/vnd.api+json"},
    body:JSON.stringify({data:{type:"checkouts",
      attributes:{checkout_data:{custom}, product_options:{redirect_url:`${process.env.PUBLIC_URL||""}/r/${custom.readingId}`}},
      relationships:{store:{data:{type:"stores",id:LS_STORE}},variant:{data:{type:"variants",id:variantId}}}}})});
  const j:any=await res.json(); return j?.data?.attributes?.url||"/?error=checkout";
}
async function verifyWebhook(raw:string,sig:string){
  if(!WEBHOOK_SECRET)throw new BadInput("no webhook secret");
  const mac=createHmac("sha256",WEBHOOK_SECRET).update(raw).digest("hex");
  const a=Buffer.from(sig||"","utf8"),e=Buffer.from(mac,"utf8");
  if(a.length!==e.length||!timingSafeEqual(a,e))throw new BadInput("bad signature");
}

Bun.serve({port:PORT, idleTimeout:150, async fetch(req){ // 풍부화 LLM 대기 위해 idleTimeout 상향
  const url=new URL(req.url); const path=url.pathname;
  try{
    // 무료 티저
    if(path==="/api/saju/teaser"){ const {b,name}=validate(Object.fromEntries(url.searchParams)); return json(teaserPayload(b,name)); }

    // ── K-pop 아이돌 궁합 (무료 — 바이럴 입구) ──
    if(path==="/api/idols"){ // 검색(자동완성)
      const q=(url.searchParams.get("q")||"").trim().toLowerCase();
      const res=!q?[]:IDOLS.filter(i=>i.stage.toLowerCase().includes(q)||(i.group||"").toLowerCase().includes(q))
        .slice(0,30).map(i=>({id:i.id,stage:i.stage,group:i.group,dob:i.dob}));
      return json({idols:res});
    }
    if(path==="/api/best-idols"){ // 나와 가장 잘 맞는 아이돌
      const {b}=validate(Object.fromEntries(url.searchParams)); const c=computeSaju(b);
      const gender=url.searchParams.get("gender")||undefined;
      return json({best:bestIdols(c,IDOLS,8,gender)});
    }
    if(path==="/api/compat"){ // 특정 아이돌과 나
      const q=Object.fromEntries(url.searchParams); const {b}=validate(q); const c=computeSaju(b);
      const idol=IDOLS.find(i=>String(i.id)===String(q.idol)); if(!idol||!idol.chart) return json({error:"idol not found"},404);
      const r=computeCompat(c,idol.chart,{idolStage:idol.stage,idolAge:2026-idol.year});
      return json({result:r, idol:{id:idol.id,stage:idol.stage,group:idol.group,dob:idol.dob}});
    }

    // 체크아웃 (코어 신규 or 애드온 해금)
    if(path==="/api/checkout"&&req.method==="POST"){
      const body=await req.json().catch(()=>({}));
      const mod=String(body.module||"core"); if(!META(mod)) throw new BadInput("bad module");
      if(mod==="core"){
        const {b,name,email}=validate(body); const id=db.createReading({...b,name},email??undefined, TEST_MODE?1:0);
        if(TEST_MODE){ db.grantModule(id,"core"); return json({url:`/r/${id}`,mode:"test"}); }
        const intent=db.createIntent(id,"core");
        return json({url:await lemonCheckout({readingId:id,module:"core",intent}, moduleVariant("core")!),mode:"live"});
      } else { // 애드온: 기존 리딩에 부여
        const readingId=String(body.readingId||""); const row=db.getReading(readingId); if(!row) throw new BadInput("no reading");
        if(TEST_MODE){ db.grantModule(readingId,mod); prewarm(readingId,mod); return json({url:`/r/${readingId}?open=${mod}`,mode:"test"}); }
        const intent=db.createIntent(readingId,mod);
        return json({url:await lemonCheckout({readingId,module:mod,intent}, moduleVariant(mod)!),mode:"live"});
      }
    }
    // 리딩 메타(대시보드)
    if(path.startsWith("/api/reading/")){
      const parts=path.split("/"); const id=parts[3];
      const row=db.getReading(id); if(!row) return json({error:"not found"},404);
      if(!row.paid) return json({error:"unpaid"},402);
      // 모듈 콘텐츠 (C: 캐시 있으면 즉시, 없으면 프리워밍 후 pending → 프론트 폴링)
      if(parts[4]==="module"&&parts[5]){
        const mod=parts[5]; const m=META(mod); if(!m) return json({error:"bad module"},400);
        if(!db.hasModule(id,mod)) return json({locked:true,meta:m},402);
        const cached=db.getModuleCache(id,mod);
        if(cached) return json({module:mod, content:cached});
        if(m.needsPhoto) return json({needsPhoto:true, meta:m});   // 손금: 사진 필요
        prewarm(id,mod); return json({pending:true, meta:m}, 202);  // 비동기 준비중
      }
      // 손금/관상 업로드 (B: Gemini Vision)
      if(parts[4]==="palm"&&req.method==="POST"){
        if(!db.hasModule(id,"palm")) return json({locked:true,meta:META("palm")},402);
        const body=await req.json().catch(()=>({})); const img=String(body.image||""); const mime=String(body.mime||"image/jpeg");
        if(!img||img.length>8_000_000) throw new BadInput("bad image");
        const birth=JSON.parse(row.birth_json); const c=computeSaju(birth);
        const reading=await enrichVision(img,mime,PALM_PROMPT(factsText(c), row.korean_name||birth.name));
        const content={title:"AI Palm Reading", intro:"What your hand reveals.",
          sections: reading? [{title:"Your Palm",verdict:"",body:sanitize(reading).replace(/\n/g,"<br/>")}]
            : [{title:"Couldn't read the photo",verdict:"",body:"Please upload a clearer photo of your open left palm in good light."}]};
        db.setModuleCache(id,"palm",content); return json({module:"palm",content});
      }
      // 이름 선택 저장
      if(parts[4]==="name"&&req.method==="POST"){ const b=await req.json().catch(()=>({})); const kr=sanitize(String(b.kr||"")).slice(0,20); if(kr){db.setKoreanName(id,kr); db.clearModuleCache(id); prewarm(id,"core");} return json({ok:true}); }
      // 메타
      db.touchViewed(id); const birth=JSON.parse(row.birth_json); const c=computeSaju(birth); const x=chartCommon(c);
      const ent=db.entitlements(id);
      return json({ id, name:birth.name, koreanName:row.korean_name, needName:!row.korean_name,
        names: row.korean_name? undefined : generateNames(birth.name,c),
        pillars:x.pillars, dayMaster:x.dayMaster, zodiac:x.zodiac, strength:x.strength, meta:x.meta,
        modules: CATALOG.map(m=>({...m, unlocked: ent.includes(m.id)})), enrichEnabled });
    }
    // 웹훅
    if(path==="/api/webhook"&&req.method==="POST"){
      const raw=await req.text(); await verifyWebhook(raw,req.headers.get("X-Signature")||"");
      const ev=JSON.parse(raw); const eid=ev?.meta?.event_id||ev?.data?.id;
      if(eid&&db.hasEvent(eid)) return json({ok:true}); // 멱등(이미 처리)
      const evName=req.headers.get("X-Event-Name")||ev?.meta?.event_name;
      const attr=ev?.data?.attributes||{}; const cd=ev?.meta?.custom_data||{}; const orderId=String(ev?.data?.id||"");
      const intent=cd.intent? db.getIntent(String(cd.intent)): null;
      // 정합성: 이벤트·결제완료·스토어 일치 + intent 존재 → intent 기준 grant
      if(evName==="order_created" && attr.status==="paid" && intent && intent.status!=="paid"
         && (!LS_STORE || String(attr.store_id)===String(LS_STORE))){
        db.markIntentPaid(intent.id, orderId);
        db.markPaidByOrder(intent.reading_id, orderId);
        db.grantModule(intent.reading_id, intent.module, orderId);
        prewarm(intent.reading_id, intent.module);
      }
      // TODO(live): evName==="order_refunded" → entitlement revoke
      if(eid) db.markEvent(eid); // grant 성공 후 mark
      return json({ok:true});
    }
    // 내 리딩 — 이메일만으로 매직링크 열거 금지(타인 리딩 노출). 일회용 인증 후에만(Resend 필요).
    if(path==="/api/my"){ return json({error:"email verification required", note:"enable one-time email link (RESEND_API_KEY)"},403); }

    // /r/:id → 대시보드
    if(path.startsWith("/r/")) return new Response(Bun.file(DIR+"/reading.html"));
    // 정적 — allowlist만 (DB/소스/.env 노출 차단)
    const STATIC=new Set(["/","/app.html","/reading.html","/idols.html","/favicon.ico"]);
    if(STATIC.has(path)){ const file=DIR+(path==="/"?"/idols.html":path); const f=Bun.file(file); if(await f.exists()) return new Response(f); }
    return new Response("not found",{status:404});
  }catch(e:any){
    const bad=e instanceof BadInput; if(!bad) console.error("[server]",e);
    return json({error: bad?(e.message||"bad request"):"server error"}, bad?400:500);
  }
}});
console.log(`K-Saju v3 on http://localhost:${PORT}  payment=${TEST_MODE?"TEST":"LIVE"}  enrich=${enrichEnabled?"ON":"off"}`);
