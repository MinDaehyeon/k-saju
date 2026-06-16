// ============================================================
// 모듈형 운세 카탈로그 — 코어 + 애드온(따로 해금=별도 서비스/업셀).
//  각 모듈 콘텐츠는 결정론(차트 기반). 서버에서 LLM 풍부화 후 캐시.
// ============================================================
import { SajuChart, STEMS, BRANCHES, BRANCHES_KR, STEMS_KR, STEM_ELEM, BRANCH_ELEM, ELEM_EN } from "./saju.ts";
import { Reading } from "./reading.ts";

export interface ModuleMeta{ id:string; title:string; price:number; emoji:string; teaser:string; addon:boolean; needsPhoto?:boolean; }
export const CATALOG: ModuleMeta[] = [
  {id:"core",        title:"Your Saju Reading",            price:2.99, emoji:"🔮", addon:false, teaser:"Four Pillars · day master · wealth · love · career · 2026 · luck."},
  {id:"monthly_2026",title:"2026 Month-by-Month",          price:3.99, emoji:"📅", addon:true,  teaser:"All 12 months of your Fire Horse year, decoded one by one."},
  {id:"daeun_life",  title:"Your Life Map · Great Luck",   price:4.99, emoji:"🗺️", addon:true,  teaser:"Your 10-year luck cycles — the decades that make or break you."},
  {id:"love_deep",   title:"Love & Marriage Deep-Dive",    price:2.99, emoji:"💕", addon:true,  teaser:"Your ideal partner, your marriage years, your red flags."},
  {id:"palm",        title:"AI Palm Reading (손금)",       price:2.99, emoji:"✋", addon:true,  needsPhoto:true, teaser:"Upload your palm — AI reads your heart, head & life lines."},
];
// 손금 비전 프롬프트 (한국 손금/관상 + 사주 컨텍스트)
export const PALM_PROMPT=(facts:string,kor:string)=>
`You are a Korean palmistry (손금) + Saju master. Read THIS palm photo for ${kor||"the client"}.
Use the visible hand lines (heart 감정선, head 두뇌선, life 생명선, fate 운명선) and mounts.
Their Saju context (do not contradict): ${facts}
Write a warm, specific, mystical English reading in 4 short sections with markdown-free headings:
LOVE LINE, MIND & TALENT, LIFE & HEALTH, FATE & FORTUNE. 2-3 sentences each. If the image is not a clear palm, say so kindly and ask for a clearer left-palm photo.`;
export const META = (id:string)=>CATALOG.find(m=>m.id===id);

const GEN=(a:number,b:number)=>(a+1)%5===b, CTRL=(a:number,b:number)=>(a+2)%5===b;
function group(dm:number, other:number){const de=STEM_ELEM[dm],oe=STEM_ELEM[other];
  if(de===oe)return 0; if(GEN(de,oe))return 1; if(CTRL(de,oe))return 2; if(CTRL(oe,de))return 3; return 4;}
const GVERD=["Self & Rivals","Output & Visibility","Wealth & Opportunity","Duty & Pressure","Support & Learning"];
const GTHEME=[
 "a month to back yourself — independence, allies, and reclaiming your lane.",
 "your visibility spikes — create, publish, launch; the world is watching.",
 "money moves toward you — deals, raises, side income; strike now.",
 "weight and structure — responsibility, commitments, a foundation being laid.",
 "a refilling phase — study, mentors, rest; plant now, harvest later."];
export interface ModSection{ title:string; verdict:string; body:string; }
export interface ModuleContent{ title:string; intro:string; sections:ModSection[]; }

const MONTHS_2026=[ // (월지순 寅~丑) 대략 양력 매핑
 ["Feb 2026","寅"],["Mar 2026","卯"],["Apr 2026","辰"],["May 2026","巳"],["Jun 2026","午"],["Jul 2026","未"],
 ["Aug 2026","申"],["Sep 2026","酉"],["Oct 2026","戌"],["Nov 2026","亥"],["Dec 2026","子"],["Jan 2027","丑"]];

function monthly2026(c:SajuChart):ModSection[]{
  // 2026=丙년 → 寅월 천간(오호둔)=庚(6). 월별 천간=(6+순서)%10
  const firstStem=6;
  return MONTHS_2026.map(([label,brCn],i)=>{
    const stem=(firstStem+i)%10, br=BRANCHES.indexOf(brCn);
    const g=group(c.dayMaster,stem);
    return {title:`${label} · ${STEMS[stem]}${brCn}`, verdict:GVERD[g], body:`This month activates ${GVERD[g]} — ${GTHEME[g]}`};
  });
}
function daeunLife(c:SajuChart):ModSection[]{
  if(!c.daeun) return [{title:"Hour unknown",verdict:"",body:"Your great-luck map needs your birth time. Add it for the full life map."}];
  return c.daeun.list.map(d=>{
    const stem=STEMS.indexOf(d.gz[0]); const g=group(c.dayMaster,stem);
    return {title:`Age ${d.age}–${d.age+9} · ${d.gzKR}`, verdict:GVERD[g],
      body:`A decade of ${GVERD[g]}: ${GTHEME[g]} ${c.daeun!.direction==="forward"?"":"(your cycles run in reverse — early maturity)"}`};
  });
}
function loveDeep(c:SajuChart, base:Reading, opts:{gender?:"M"|"F"}):ModSection[]{
  const spouseElem=BRANCH_ELEM[c.day.branch];
  const sg=opts.gender==="F"?3:2;
  // 결혼 유리 대운: 배우자 별(재/관) 십성이 강해지는 시기
  const favAges=(c.daeun?.list||[]).filter(d=>{const st=STEMS.indexOf(d.gz[0]);return group(c.dayMaster,st)===sg;}).map(d=>d.age);
  return [
    {title:"Your Ideal Partner", verdict:`${ELEM_EN[spouseElem]} energy`, body:base.love.body},
    {title:"Marriage Timing", verdict: favAges.length?`Favorable around age ${favAges.join(", ")}`:"Steady, self-paced",
      body: favAges.length
        ? `Your Spouse star strengthens during your ${favAges.join(", ")} luck cycles — these are your windows where commitment flows most naturally.`
        : `Your marriage luck is steady rather than spiked — you wed on your own timing, not the crowd's. The right cycle rewards patience over rush.`},
    {title:"Your Red Flag", verdict:"Watch this pattern",
      body: c.strength.verdict==="strong"
        ? `Your chart runs strong, so in love your risk is dominance — needing to lead and fix. Your match thrives when you let them carry half.`
        : `Your chart runs ${c.strength.verdict}, so your risk is over-merging — losing yourself in the other. Keep one root that is only yours.`},
  ];
}

export function buildModule(id:string, c:SajuChart, base:Reading, opts:{gender?:"M"|"F"}):ModuleContent{
  const m=META(id);
  if(id==="core") return {title:m!.title, intro:"", sections:["overview","personality","wealth","love","career","year2026","luck"].map(k=>(base as any)[k])};
  if(id==="monthly_2026") return {title:m!.title, intro:"Your Fire Horse year, month by month.", sections:monthly2026(c)};
  if(id==="daeun_life") return {title:m!.title, intro:"The 10-year currents shaping your life.", sections:daeunLife(c)};
  if(id==="love_deep") return {title:m!.title, intro:"Your heart, decoded.", sections:loveDeep(c,base,opts)};
  return {title:"Coming soon", intro:"", sections:[{title:"Soon",verdict:"",body:"This reading is being prepared."}]};
}
