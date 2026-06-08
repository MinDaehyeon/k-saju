// ============================================================
// K-Saju Engine v2 — 진짜 만세력 규칙(결정론적). 같은 입력 => 같은 출력.
//  일주=JDN 60갑자 / 년주=입춘(황경315°) / 월주=절기+오호둔 / 시주=진태양시+오서둔
//  + 진태양시 자정 경계로 일주 일관 보정(조자시 학파, 명시적/결정론적)
//  + 지장간 / 신강·신약(휴리스틱) / 대운(순역·시작나이) / 오행·십성
//  천문: Meeus 저정밀 태양황경/균시차. 절입 ±수시간 구간은 고정밀 ephemeris 권장(주의표시).
// ============================================================

export const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
export const STEMS_KR = ["갑","을","병","정","무","기","경","신","임","계"];
export const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
export const BRANCHES_KR = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
export const ANIMALS = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
export const ANIMAL_EMOJI = ["🐀","🐂","🐅","🐇","🐉","🐍","🐎","🐐","🐒","🐓","🐕","🐖"];
export const STEM_ELEM  = [0,0,1,1,2,2,3,3,4,4]; // 木火土金水
export const BRANCH_ELEM= [4,2,0,0,2,1,1,2,3,3,2,4];
export const STEM_YANG  = [1,0,1,0,1,0,1,0,1,0];
export const ELEM_EN = ["Wood","Fire","Earth","Metal","Water"];
export const ELEM_CN = ["木","火","土","金","水"];
// 지장간(정기·중기·여기) — 천간 인덱스
const HIDDEN:number[][] = [
  [9],        // 子 癸
  [5,9,7],    // 丑 己癸辛
  [0,2,4],    // 寅 甲丙戊
  [1],        // 卯 乙
  [4,1,9],    // 辰 戊乙癸
  [2,6,4],    // 巳 丙庚戊
  [3,5],      // 午 丁己
  [5,3,1],    // 未 己丁乙
  [6,8,4],    // 申 庚壬戊
  [7],        // 酉 辛
  [4,7,3],    // 戌 戊辛丁
  [8,0],      // 亥 壬甲
];
const GEN = (a:number,b:number)=> (a+1)%5===b;
const CTRL= (a:number,b:number)=> (a+2)%5===b;

function toJD(d: Date): number { return d.getTime()/86400000 + 2440587.5; }
function gregToJDN(y:number,m:number,d:number):number{
  const a=Math.floor((14-m)/12), yy=y+4800-a, mm=m+12*a-3;
  return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;
}
const D2R=Math.PI/180;
function sunLongitude(jd:number):number{
  const T=(jd-2451545.0)/36525;
  const L0=(280.46646+36000.76983*T+0.0003032*T*T);
  const M=(357.52911+35999.05029*T-0.0001537*T*T);
  const Mr=M*D2R;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)
        +(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
  const omega=125.04-1934.136*T;
  const lambda=L0+C-0.00569-0.00478*Math.sin(omega*D2R);
  return ((lambda%360)+360)%360;
}
function equationOfTime(jd:number):number{
  const T=(jd-2451545.0)/36525;
  const e=0.016708634-0.000042037*T-0.0000001267*T*T;
  const L0=(280.46646+36000.76983*T+0.0003032*T*T)*D2R;
  const M=(357.52911+35999.05029*T-0.0001537*T*T)*D2R;
  const eps=(23.439291-0.0130042*T)*D2R;
  const y=Math.tan(eps/2)**2;
  const Et=y*Math.sin(2*L0)-2*e*Math.sin(M)+4*e*y*Math.sin(M)*Math.cos(2*L0)
          -0.5*y*y*Math.sin(4*L0)-1.25*e*e*Math.sin(2*M);
  return Et/D2R*4;
}
// targetDeg 도달 UTC 순간(이분법). guess는 ±3일 내.
function solarTermInstant(targetDeg:number, guessJD:number):number{
  let lo=guessJD-3, hi=guessJD+3;
  const norm=(l:number)=>{let v=((l-targetDeg)%360+540)%360-180;return v;};
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;
    if(norm(sunLongitude(lo))*norm(sunLongitude(mid))<=0) hi=mid; else lo=mid;}
  return (lo+hi)/2;
}

export interface Birth{ year:number; month:number; day:number; hour:number; minute:number;
  longitude?:number; tzOffsetHours?:number; gender?:"M"|"F"; calendar?:"solar"|"lunar"; }
export interface Pillar{ stem:number; branch:number; gz:string; gzKR:string; }
export interface Daeun{ direction:"forward"|"backward"; startAge:number;
  list:{age:number; gz:string; gzKR:string}[]; }
export interface SajuChart{
  year:Pillar; month:Pillar; day:Pillar; hour:Pillar|null;
  dayMaster:number; dayMasterElem:number;
  elements:{count:number[]; missing:number[]; strongest:number; weakest:number};
  strength:{score:number; verdict:"strong"|"balanced"|"weak"};
  tenGods:{year:string;month:string;day:string;hour:string|null};
  hiddenStems:{year:number[];month:number[];day:number[];hour:number[]|null};
  daeun:Daeun|null;
  zodiac:number; trueSolarMinutes:number;
  meta:{solarLongitude:number; ipchunBefore:boolean; dayRolled:number;
        nearTermBoundary:boolean; tzNote?:string; warning?:string};
}

function mkPillar(stem:number,branch:number):Pillar{
  return {stem,branch,gz:STEMS[stem]+BRANCHES[branch],gzKR:STEMS_KR[stem]+BRANCHES_KR[branch]};
}
function tenGod(dayStem:number, other:number):string{
  const de=STEM_ELEM[dayStem], oe=STEM_ELEM[other];
  const same=STEM_YANG[dayStem]===STEM_YANG[other];
  if(de===oe) return same?"비견(Companion)":"겁재(Rob Wealth)";
  if(GEN(de,oe)) return same?"식신(Eating God)":"상관(Hurting Officer)";
  if(GEN(oe,de)) return same?"편인(Indirect Resource)":"정인(Direct Resource)";
  if(CTRL(de,oe)) return same?"편재(Indirect Wealth)":"정재(Direct Wealth)";
  if(CTRL(oe,de)) return same?"편관(Seven Killings)":"정관(Direct Officer)";
  return "?";
}

export function computeSaju(b:Birth):SajuChart{
  if(b.calendar==="lunar") throw new Error("lunar input not yet supported — convert to solar first");
  const lon=b.longitude??126.978, tz=b.tzOffsetHours??9;
  const utc=new Date(Date.UTC(b.year,b.month-1,b.day,b.hour-tz,b.minute,0));
  const jd=toJD(utc);
  const lambda=sunLongitude(jd);

  // ---- 진태양시 + 자정 경계로 날짜 롤오버(일주 일관) ----
  const civilMin=b.hour*60+b.minute;
  const corr=4*(lon-15*tz)+equationOfTime(jd);
  const trueSolarMin=civilMin+corr;
  const dayRolled=Math.floor(trueSolarMin/1440); // -1/0/+1
  const td=new Date(Date.UTC(b.year,b.month-1,b.day)); td.setUTCDate(td.getUTCDate()+dayRolled);
  const ty=td.getUTCFullYear(),tm=td.getUTCMonth()+1,tdd=td.getUTCDate();
  const jdn=gregToJDN(ty,tm,tdd);
  const dayStem=((jdn+9)%10+10)%10, dayBranch=((jdn+1)%12+12)%12;

  // ---- 년주: 입춘 경계 ----
  const ipchun=solarTermInstant(315, toJD(new Date(Date.UTC(b.year,1,4))));
  const ipchunBefore=jd<ipchun;
  const sy=ipchunBefore?b.year-1:b.year;
  const yearStem=((sy-4)%10+10)%10, yearBranch=((sy-4)%12+12)%12;

  // ---- 월주: 절기 황경 + 오호둔 ----
  const g=(((lambda-315)%360)+360)%360;
  const monthBranch=(2+Math.floor(g/30))%12;
  const monthFirstStem=[2,4,6,8,0][yearStem%5];
  const monthStem=(monthFirstStem+(((monthBranch-2)%12+12)%12))%10;

  // ---- 시주: 진태양시 + 오서둔 ----
  const tsm=((trueSolarMin%1440)+1440)%1440;
  const hourBranch=Math.floor(((tsm+60)%1440)/120);
  const hourStem=([0,2,4,6,8][dayStem%5]+hourBranch)%10;
  const hourPillar=mkPillar(hourStem,hourBranch);

  // ---- 오행 분포(천간4 + 지지 본오행4) ----
  const count=[0,0,0,0,0];
  [yearStem,monthStem,dayStem,hourStem].forEach(s=>count[STEM_ELEM[s]]++);
  [yearBranch,monthBranch,dayBranch,hourBranch].forEach(br=>count[BRANCH_ELEM[br]]++);
  const missing=count.map((c,i)=>c===0?i:-1).filter(i=>i>=0);
  const strongest=count.indexOf(Math.max(...count));
  const weakest=count.indexOf(Math.min(...count));

  // ---- 신강·신약(휴리스틱): 월령 가중 + 지장간 정기 ----
  const dm=STEM_ELEM[dayStem];
  const support=(e:number)=> e===dm || GEN(e,dm); // 비겁 or 인성
  let s=0;
  // 월령(월지 본오행) 강하게
  s += support(BRANCH_ELEM[monthBranch])?3:-2;
  [yearStem,hourStem].forEach(st=> s+= support(STEM_ELEM[st])?1:-1);
  [yearBranch,dayBranch,hourBranch].forEach(br=> s+= support(BRANCH_ELEM[br])?1:-1);
  // 지장간 정기 약가중
  [yearBranch,monthBranch,dayBranch,hourBranch].forEach(br=> s+= support(STEM_ELEM[HIDDEN[br][0]])?0.5:-0.5);
  const verdict:"strong"|"balanced"|"weak"= s>=2?"strong": s<=-2?"weak":"balanced";

  // ---- 대운: 순/역 + 시작나이 ----
  let daeun:Daeun|null=null;
  if(b.gender){
    const yangYear=STEM_YANG[yearStem]===1;
    const forward=(yangYear && b.gender==="M")||(!yangYear && b.gender==="F");
    // 다음/이전 절(節) 까지 일수 (절 경계 = 황경 grid 315+30k)
    const nextOff=(Math.floor(g/30)+1)*30, prevOff=Math.floor(g/30)*30;
    const nextDeg=(315+nextOff)%360, prevDeg=(315+prevOff)%360;
    const guessN=jd+(nextOff-g)/0.98565, guessP=jd-(g-prevOff)/0.98565;
    const days = forward ? (solarTermInstant(nextDeg,guessN)-jd) : (jd-solarTermInstant(prevDeg,guessP));
    const startAge=Math.max(0,Math.round(days/3*10)/10);
    const list=[];
    for(let i=1;i<=8;i++){
      const idx=(monthStem*12+monthBranch); // not used; sequence by 60갑자 from 월주
      const stepStem=((monthStem+(forward?i:-i))%10+10)%10;
      const stepBranch=((monthBranch+(forward?i:-i))%12+12)%12;
      list.push({age:Math.round(startAge)+(i-1)*10, gz:STEMS[stepStem]+BRANCHES[stepBranch], gzKR:STEMS_KR[stepStem]+BRANCHES_KR[stepBranch]});
    }
    daeun={direction:forward?"forward":"backward", startAge, list};
  }

  // 경계 경고
  const nearTermBoundary = (g%30)<0.5 || (g%30)>29.5 || Math.abs(jd-ipchun)<0.1;
  const tzNote = (b.year<1962)? "1961년 이전 한국 표준시는 UTC+9가 아닐 수 있음 — tzOffsetHours 명시 권장":undefined;

  return {
    year:mkPillar(yearStem,yearBranch), month:mkPillar(monthStem,monthBranch),
    day:mkPillar(dayStem,dayBranch), hour:hourPillar,
    dayMaster:dayStem, dayMasterElem:dm,
    elements:{count,missing,strongest,weakest},
    strength:{score:Math.round(s*10)/10, verdict},
    tenGods:{year:tenGod(dayStem,yearStem),month:tenGod(dayStem,monthStem),day:"일간(Self)",hour:tenGod(dayStem,hourStem)},
    hiddenStems:{year:HIDDEN[yearBranch],month:HIDDEN[monthBranch],day:HIDDEN[dayBranch],hour:HIDDEN[hourBranch]},
    daeun, zodiac:yearBranch, trueSolarMinutes:Math.round(trueSolarMin),
    meta:{solarLongitude:Math.round(lambda*100)/100, ipchunBefore, dayRolled, nearTermBoundary, tzNote}
  };
}
