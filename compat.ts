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
export interface CompatDim{ key:string; label:string; emoji:string; score:number; note:string; }
export interface CompatResult{
  score:number; type:string; emoji:string; headline:string; body:string;
  factors:string[]; isMinor:boolean; idolElement:string; idolAnimal:string;
  dimensions:CompatDim[]; pull:string; caution:string;
  you:{element:string; animal:string; dayMaster:string};
  them:{element:string; animal:string; dayMaster:string};
}
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Math.round(n)));
const band=(s:number,strong:string,mid:string,low:string)=> s>=80?strong : s>=65?mid : low;

const TYPES:{[k:string]:[string,string]}={ // key -> [emoji, type name]
  soulmate:["✨","Destined Frequency"], cozy:["🍯","Cozy Harmony"], lift:["🌱","You Lift Each Other"],
  twin:["🔁","Twin Flames"], spicy:["🔥","Spicy Tension"], magnet:["⚡","Magnetic Push & Pull"], slow:["🌙","Slow-Burn Mystery"],
  cheer:["💛","Fan Cheer Energy"],
};

export function computeCompat(user:SajuChart, idol:IdolChart, opts:{idolStage?:string; idolAge?:number; userHasTime?:boolean}={}):CompatResult{
  const minor=(opts.idolAge??99)<18;
  const f:string[]=[]; const pos:[number,string][]=[]; const neg:[number,string][]=[];
  const uyb=user.year.branch, iyb=idol.yb;          // 년지(띠)
  const udm=user.dayMaster, idm=idol.dm;            // 일간
  const ue=STEM_ELEM[udm], ie=STEM_ELEM[idm];       // 일간 오행
  const udb=user.day.branch, idb=idol.db;           // 일지(배우자궁)
  const umb=user.month.branch, imb=idol.mb;         // 월지(가치관·사회궁)
  const uElem=ELEM_EN[user.dayMasterElem], iElem=ELEM_EN[idol.dmE];

  // ── 차원 1) 💗 애정·끌림: 일간 천간합 + 일지(배우자궁) ──
  let romance=60;
  if(isCheonhap(udm,idm)){ romance+=28; pos.push([28,`a Heavenly-Stem union (天干合) — your core selves magnetically bond, one of Saju's rarest attraction signs`]); }
  else if(GEN(ue,ie)||GEN(ie,ue)){ romance+=12; pos.push([12,`one of you naturally nourishes the other (the Generating cycle of the elements)`]); }
  else if(ue===ie){ romance+=6; }
  else if(CTRL(ue,ie)||CTRL(ie,ue)){ romance-=8; neg.push([8,`your core elements test each other through the Controlling cycle — a quiet battle of wills`]); }
  if(inSamhap(udb,idb)||isYukhap(udb,idb)){ romance+=16; pos.push([16,`your Spouse Palaces (the Day branch in Saju) click into harmony — a deep, instinctive draw`]); }
  else if(udb===idb){ romance+=7; pos.push([7,`the same Spouse-Palace sign — you feel instantly familiar`]); }
  else if(isChung(udb,idb)){ romance-=12; neg.push([12,`a Spouse-Palace clash — magnetic from afar, volatile up close`]); }

  // ── 차원 2) 💬 소통·바이브: 일간 오행 생극 + 월지(가치관) ──
  let vibe=60;
  if(ue===ie){ vibe+=18; pos.push([10,`the same elemental wavelength — you just *get* each other`]); }
  else if(GEN(ue,ie)||GEN(ie,ue)){ vibe+=14; }
  else if(CTRL(ue,ie)||CTRL(ie,ue)){ vibe-=10; }
  if(inSamhap(umb,imb)||isYukhap(umb,imb)){ vibe+=12; pos.push([8,`your Month branches harmonize — the same things matter to you both`]); }
  else if(umb===imb){ vibe+=8; }
  else if(isChung(umb,imb)){ vibe-=8; neg.push([6,`your values run in different directions — worth talking through`]); }

  // ── 차원 3) 🌙 장기궁합·운명: 띠(년지) 삼합/육합 + 오행 보완 ──
  let longterm=58;
  if(inSamhap(uyb,iyb)){ longterm+=22; pos.push([22,`a zodiac Trine (三合) between your ${ANIMALS[uyb]} and ${ANIMALS[iyb]} signs — a pairing that feels fated`]); }
  else if(isYukhap(uyb,iyb)){ longterm+=18; pos.push([18,`a Six-Harmony zodiac union (六合) — the classic "made to last" match`]); }
  else if(uyb===iyb){ longterm+=8; }
  else if(isChung(uyb,iyb)){ longterm-=16; neg.push([16,`a zodiac clash between your ${ANIMALS[uyb]} and ${ANIMALS[iyb]} signs — fireworks now, friction later`]); }
  const fillsMe=user.elements.missing.filter(e=>idol.elem[e]>=2);
  const fillsThem=idol.miss.filter(e=>user.elements.count[e]>=2);
  if(fillsMe.length+fillsThem.length>0){ longterm+=Math.min(15,(fillsMe.length+fillsThem.length)*5);
    pos.push([10,`you help fill each other's missing ${[...new Set(fillsMe)].map(e=>ELEM_EN[e]).join("/")||iElem} energy`]); }

  // ── 차원 4) ⚡ 스파크·텐션: 충·극이 오히려 불꽃 ──
  let spark=56;
  if(isChung(uyb,iyb)) spark+=20;
  if(isChung(udb,idb)) spark+=14;
  if(CTRL(ue,ie)||CTRL(ie,ue)) spark+=12;
  if(spark<=56) spark=clamp(56-(romance-60)/4,40,60); // 너무 잔잔하면 스파크 낮음

  // 표시값(완화 — 낮은 점수 금지)
  const R=clamp(romance,52,99), V=clamp(vibe,52,99), L=clamp(longterm,52,99), S=clamp(spark,40,99);
  const overall=clamp(0.34*R+0.20*V+0.32*L+0.14*S, 58, 99);

  const dimensions:CompatDim[]=[
    { key:"romance", label:minor?"Adoration":"Romance & Attraction", emoji:"💗", score:R,
      note:band(R,"instant magnetism","warm and real","a slow, earned spark") },
    { key:"vibe", label:"Vibe & Communication", emoji:"💬", score:V,
      note:band(V,"effortless flow","easy once you click","different emotional languages") },
    { key:"longterm", label:minor?"Inspiration":"Long-term Harmony", emoji:"🌙", score:L,
      note:band(L,"built to last","steady footing","grows with effort") },
    { key:"spark", label:"Spark & Tension", emoji:"⚡", score:S,
      note:band(S,"electric, never boring","playful heat","calm and gentle") },
  ];

  // 끌리는 점 / 조심할 점
  pos.sort((a,b)=>b[0]-a[0]); neg.sort((a,b)=>b[0]-a[0]);
  const pull = pos[0]?.[1] || `your ${uElem} and ${iElem} energies balance quietly`;
  const caution = neg[0]?.[1] || `almost too harmonious — keep a little mystery alive`;
  const factors=[...pos.slice(1,4).map(p=>p[1])]; // pull은 따로 표시하므로 그 다음 근거들

  // 케미 타입(헤드라인용)
  let key="slow";
  if(minor) key="cheer";
  else if(isCheonhap(udm,idm)||(inSamhap(uyb,iyb)&&overall>=82)) key="soulmate";
  else if(isYukhap(uyb,iyb)||overall>=74) key="cozy";
  else if(GEN(ue,ie)||GEN(ie,ue)) key="lift";
  else if(ue===ie) key="twin";
  else if(CTRL(ue,ie)||CTRL(ie,ue)) key="magnet";
  else if(isChung(uyb,iyb)) key="spicy";
  const [emoji,type]=TYPES[key];
  const name=opts.idolStage||"your bias";
  const headline = minor ? `${name} is your ${type} ${emoji}` : `You + ${name}: ${type} ${emoji} · ${overall}%`;

  // 본문 보강용: 띠 관계 한 줄 + 최강/최약 차원 하이라이트 + 케미별 조언
  const zl = inSamhap(uyb,iyb)
      ? `your ${ANIMALS[uyb]} year-sign and their ${ANIMALS[iyb]} fall into a rare three-harmony trine (삼합), the old-soul kind of recognition`
    : isYukhap(uyb,iyb)
      ? `your ${ANIMALS[uyb]} and their ${ANIMALS[iyb]} form a Six-Harmony pair (육합), the classic "meant to meet" sign`
    : uyb===iyb
      ? `you share the ${ANIMALS[uyb]} year-sign, so you instinctively move to the same rhythm`
    : isChung(uyb,iyb)
      ? `your ${ANIMALS[uyb]} sits directly across from their ${ANIMALS[iyb]} (충) — a charged, opposites-attract spark`
      : `your ${ANIMALS[uyb]} and their ${ANIMALS[iyb]} signs take a little time to tune into each other`;
  const sortedDim=[...dimensions].sort((a,b)=>b.score-a.score);
  const top=sortedDim[0], low=sortedDim[sortedDim.length-1];
  const advice:{[k:string]:string}={
    soulmate:`A bond this aligned is rare enough to handle with care — protect it.`,
    cozy:`Lean into the ease; this is the kind of match that quietly grows stronger with time.`,
    lift:`Keep cheering each other on — you're at your best when you're building something together.`,
    twin:`Take turns leading and you'll feel unstoppable; both grab the wheel and you'll stall.`,
    magnet:`The friction is the fun — just don't mistake the intensity for instability.`,
    spicy:`Channel the heat into play instead of pressure and it stays electric for years.`,
    slow:`Don't force the spark — let this one reveal itself chapter by chapter.`,
    cheer:`A bond to cheer from the front row — pure hype, zero pressure.`,
  };
  let body:string;
  if(minor){
    body=`In the Korean chart, ${zl}. Your ${uElem} energy meets ${name}'s ${iElem}, and the standout note is ${top.label.toLowerCase()} at ${top.score}% — ${top.note}. Read together, this is fan-cheer chemistry: support, hype, and good vibes only, nothing more. ${advice.cheer} 💛`;
  } else {
    const flavor:{[k:string]:string}={
      soulmate:`This is the rare one. Your ${uElem} Day Master and ${name}'s ${iElem} lock into a destined union — the kind of pull a Saju reader would circle on the chart.`,
      cozy:`Your two charts feel like stepping into a warm room. ${uElem} and ${iElem} simply *fit* — easy, safe, a connection you wouldn't have to fight for.`,
      lift:`One of you naturally fuels the other. ${uElem} and ${iElem} feed each other's growth — you'd each become more fully yourself in the other's company.`,
      twin:`Same element, same wavelength — two ${uElem} hearts beating in time. Intuitive and deeply comfortable, even if you'd both instinctively want to lead.`,
      magnet:`A true push-and-pull. Your ${uElem} and ${iElem} energies test and bend each other — frustrating, magnetic, and never, ever boring.`,
      spicy:`Your zodiac signs meet head-on — and that head-on collision is exactly the spark. High tension, high heat, the kind you don't forget.`,
      slow:`No fireworks on day one — yours is a slow burn. ${uElem} and ${iElem} unfold to each other gradually, layer by layer.`,
    };
    body=`${flavor[key]} In the Korean chart, ${zl}. Where you shine brightest together is ${top.label.toLowerCase()} at ${top.score}% — ${top.note} — while ${low.label.toLowerCase()} (${low.score}%) is the slower-burn note, where ${low.note}, so give that side a little patience. ${advice[key]||""}`;
    if(opts.userHasTime===false) body+=` Add your exact birth time and the reading sharpens even further.`;
  }
  return { score:overall, type, emoji, headline, body, factors, isMinor:minor,
    idolElement:iElem, idolAnimal:ANIMALS[idol.zodiac], dimensions, pull, caution,
    you:{element:uElem, animal:ANIMALS[uyb], dayMaster:STEMS[udm]},
    them:{element:iElem, animal:ANIMALS[iyb], dayMaster:STEMS[idm]} };
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
