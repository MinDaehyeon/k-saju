// ============================================================
// 궁합(Compatibility) 엔진 — 진짜 명리 규칙(결정론). 같은 쌍 => 같은 결과.
//  띠(년지) 삼합·육합·충 + 일간 천간합·생극 + 일지 합충 + 오행 보완 → 점수 + 케미타입.
//  가드레일(Codex): 점수 완화(낮은 점수 금지), 케미타입 분류, 미성년 아이돌=응원케미(로맨스 금지).
// ============================================================
import { SajuChart, STEMS, BRANCHES, ANIMALS, ELEM_EN, STEM_ELEM, BRANCH_ELEM, STEM_YANG } from "./saju.ts";

const GEN=(a:number,b:number)=>(a+1)%5===b, CTRL=(a:number,b:number)=>(a+2)%5===b;
// 삼합(三合) 그룹 (지지 idx)
const SAMHAP=[[8,0,4],[11,3,7],[2,6,10],[5,9,1]]; // 申子辰水 / 亥卯未木 / 寅午戌火 / 巳酉丑金
const inSamhap=(a:number,b:number)=>a!==b&&SAMHAP.some(g=>g.includes(a)&&g.includes(b));
// 육합(六合) 쌍
const YUKHAP:[number,number][]=[[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
const isYukhap=(a:number,b:number)=>YUKHAP.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
const isChung=(a:number,b:number)=>(a+6)%12===b; // 충(沖)
// 천간합(天干合): 甲己 乙庚 丙辛 丁壬 戊癸 (stem idx 차 5)
const isCheonhap=(a:number,b:number)=>Math.abs(a-b)===5;

export interface IdolChart{ dm:number; dmE:number; yb:number; mb:number; db:number; ds:number; elem:number[]; miss:number[]; zodiac:number; }
export interface CompatResult{
  score:number; type:string; emoji:string; headline:string; body:string;
  factors:string[]; isMinor:boolean; idolElement:string; idolAnimal:string;
}

const TYPES:{[k:string]:[string,string]}={ // key -> [emoji, type name]
  soulmate:["✨","Destined Frequency"], cozy:["🍯","Cozy Harmony"], lift:["🌱","You Lift Each Other"],
  twin:["🔁","Twin Flames"], spicy:["🔥","Spicy Tension"], magnet:["⚡","Magnetic Push & Pull"], slow:["🌙","Slow-Burn Mystery"],
  cheer:["💛","Fan-Cheer Energy"],
};

export function computeCompat(user:SajuChart, idol:IdolChart, opts:{idolStage?:string; idolAge?:number}={}):CompatResult{
  const minor=(opts.idolAge??99)<18;
  const f:string[]=[]; let s=50;
  // 1) 띠(년지) 궁합
  const uyb=user.year.branch, iyb=idol.yb;
  if(inSamhap(uyb,iyb)){ s+=20; f.push(`삼합 zodiac trine (${ANIMALS[uyb]}×${ANIMALS[iyb]})`); }
  else if(isYukhap(uyb,iyb)){ s+=18; f.push(`육합 zodiac union`); }
  else if(uyb===iyb){ s+=8; f.push(`same zodiac ${ANIMALS[uyb]}`); }
  else if(isChung(uyb,iyb)){ s-=14; f.push(`충 zodiac clash (electric)`); }
  // 2) 일간(日干) 궁합 — 핵심
  const udm=user.dayMaster, idm=idol.dm;
  let dmTag="neutral";
  if(isCheonhap(udm,idm)){ s+=20; dmTag="union"; f.push(`천간합 Heavenly-Stem union (${STEMS[udm]}×${STEMS[idm]}) — rarest attraction`); }
  else if(GEN(STEM_ELEM[udm],STEM_ELEM[idm])||GEN(STEM_ELEM[idm],STEM_ELEM[udm])){ s+=12; dmTag="support"; f.push(`one element feeds the other (생)`); }
  else if(STEM_ELEM[udm]===STEM_ELEM[idm]){ s+=6; dmTag="twin"; f.push(`same Day-Master element ${ELEM_EN[STEM_ELEM[udm]]}`); }
  else if(CTRL(STEM_ELEM[udm],STEM_ELEM[idm])||CTRL(STEM_ELEM[idm],STEM_ELEM[udm])){ s-=8; dmTag="control"; f.push(`one element bends the other (극) — push/pull`); }
  // 3) 일지(배우자궁) 궁합
  const udb=user.day.branch, idb=idol.db;
  if(inSamhap(udb,idb)||isYukhap(udb,idb)){ s+=12; f.push(`day-branch harmony (deep bond)`); }
  else if(udb===idb){ s+=6; }
  else if(isChung(udb,idb)){ s-=10; f.push(`day-branch clash (intense)`); }
  // 4) 오행 보완 (서로 부족한 걸 채워주나)
  const fillsMe=user.elements.missing.filter(e=>idol.elem[e]>=2).length;
  const fillsThem=idol.miss.filter(e=>user.elements.count[e]>=2).length;
  if(fillsMe+fillsThem>0){ s+=Math.min(15,(fillsMe+fillsThem)*5); f.push(`you complete each other's missing ${[...new Set([...user.elements.missing.filter(e=>idol.elem[e]>=2)])].map(e=>ELEM_EN[e]).join("/")||"elements"}`.replace(/missing $/,'')); }

  // 점수 완화: 표시는 [58,99]로 (Codex 가드 — 낮은 점수 금지)
  const raw=s; const score=Math.max(58,Math.min(99,Math.round(s)));

  // 케미 타입 결정
  let key="slow";
  if(minor) key="cheer";
  else if(dmTag==="union"||inSamhap(uyb,iyb)&&raw>=78) key="soulmate";
  else if(isYukhap(uyb,iyb)||raw>=72) key="cozy";
  else if(dmTag==="support") key="lift";
  else if(dmTag==="twin") key="twin";
  else if(dmTag==="control") key="magnet";
  else if(isChung(uyb,iyb)) key="spicy";
  const [emoji,type]=TYPES[key];

  const uElem=ELEM_EN[user.dayMasterElem], iElem=ELEM_EN[idol.dmE];
  const name=opts.idolStage||"your bias";
  const headline = minor
    ? `${name} is your ${type} ${emoji}`
    : `You + ${name}: ${type} ${emoji} · ${score}% chemistry`;

  let body:string;
  if(minor){
    body=`Your ${uElem} energy and ${name}'s ${iElem} energy make pure fan-cheer chemistry — you'd hype each other up endlessly. ${f[0]?`(${f[0]})`:""} A bond of support and good vibes, nothing more, nothing less. 💛`;
  } else {
    const flavor:{[k:string]:string}={
      soulmate:`This is the rare one. Your ${uElem} Day Master and ${name}'s ${iElem} lock into a destined union — the kind of pull Saju masters circle on a chart.`,
      cozy:`Your charts settle into each other like a warm room. ${uElem} and ${iElem} just *fit* — easy, safe, the relationship you don't have to fight for.`,
      lift:`One of you feeds the other's fire. ${uElem} and ${iElem} grow each other — you'd each become more *you* together.`,
      twin:`Same element, same wavelength — ${uElem} meets ${uElem==iElem?uElem:iElem}. Comfortable and intuitive, but you'll both want to lead.`,
      magnet:`Pure push and pull. ${uElem} bends ${iElem} (or the other way) — frustrating, magnetic, never boring.`,
      spicy:`Your zodiacs clash head-on (충) — and that's the spark. High tension, high heat. Not calm, but unforgettable.`,
      slow:`No fireworks on day one — yours is a slow-burn. ${uElem} and ${iElem} reveal each other over time.`,
    };
    body=`${flavor[key]} ${f.length?`Your chart reads: ${f.slice(0,2).join("; ")}.`:""}`;
  }
  return { score, type, emoji, headline, body, factors:f, isMinor:minor,
    idolElement:iElem, idolAnimal:ANIMALS[idol.zodiac] };
}

// 베스트매치: 아이돌 배열에서 점수 상위 N (성별 필터 옵션)
export function bestIdols(user:SajuChart, idols:any[], topN=6, genderPref?:string){
  const list = genderPref? idols.filter(i=>(i.gender||"").toLowerCase().startsWith(genderPref.toLowerCase()[0])) : idols;
  const scored = list.filter(i=>i.chart).map(i=>{
    const age=2026-i.year;
    const r=computeCompat(user,i.chart,{idolStage:i.stage,idolAge:age});
    return { id:i.id, stage:i.stage, group:i.group, dob:i.dob, gender:i.gender, score:r.score, type:r.type, emoji:r.emoji };
  });
  scored.sort((a,b)=>b.score-a.score || a.stage.localeCompare(b.stage));
  return scored.slice(0,topN);
}
