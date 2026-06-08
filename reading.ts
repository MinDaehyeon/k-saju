// ============================================================
// K-Saju Reading Layer — 계산된 사주에 '진짜 명리 규칙'으로 운세를 엮음(결정론적).
//  십성 그룹 분포 + 신강/신약 + 일지(배우자궁) + 2026 세운(丙午)으로 판단.
//  본 텍스트는 규칙 기반 템플릿. (라이브: 이 '구조화 판단'을 LLM에 넘겨 풍부한 산문화 — 사주를 지어내지 않고 narrate.)
// ============================================================
import { SajuChart, STEM_ELEM, BRANCH_ELEM, STEM_YANG, ELEM_EN } from "./saju.ts";

const GEN=(a:number,b:number)=>(a+1)%5===b, CTRL=(a:number,b:number)=>(a+2)%5===b;
// 십성 그룹: 0비겁 1식상 2재성 3관성 4인성
function group(dm:number, other:number):number{
  const de=STEM_ELEM[dm], oe=STEM_ELEM[other];
  if(de===oe)return 0; if(GEN(de,oe))return 1; if(CTRL(de,oe))return 2; if(CTRL(oe,de))return 3; return 4;
}
const GROUP_EN=["Self/Peers (비겁)","Output/Creativity (식상)","Wealth (재성)","Authority/Officer (관성)","Resource/Support (인성)"];
const REMEDY=[ // per element 木火土金水
  {color:"Emerald green",dir:"East",num:"3 & 8"},
  {color:"Crimson red",dir:"South",num:"2 & 7"},
  {color:"Golden yellow",dir:"Center",num:"5 & 10"},
  {color:"White & silver",dir:"West",num:"4 & 9"},
  {color:"Deep blue & black",dir:"North",num:"1 & 6"},
];
const DM_PERSONA=[ // by day-master element
  {t:"Wood — the Tree",p:"principled, growth-driven, and quietly stubborn. You build slowly and carry others in your shade."},
  {t:"Fire — the Flame",p:"radiant, expressive, and impossible to ignore. You lead by warmth, but you burn out on the wrong people."},
  {t:"Earth — the Mountain",p:"steady, loyal, and grounding. People build their lives on you, but you carry more than you admit."},
  {t:"Metal — the Blade",p:"sharp, principled, and precise. Your mind cuts to the truth, but your edges keep love at a distance."},
  {t:"Water — the Ocean",p:"deep, adaptive, and intuitive. You read everyone, yet hide whole storms beneath a calm surface."},
];

export interface Section{ title:string; verdict:string; body:string; }
export interface Reading{ overview:Section; personality:Section; wealth:Section;
  love:Section; career:Section; year2026:Section; luck:Section; tally:number[]; }

function esc(s:string){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]!));}
export function buildReading(c:SajuChart, opts:{name?:string; koreanName?:string; gender?:"M"|"F"}={}):Reading{
  const dm=c.dayMaster, dmE=c.dayMasterElem;
  const nm=esc(opts.koreanName||opts.name||"You"); // XSS: 사용자 입력 escape
  // 십성 그룹 분포: 년/월/시 천간 + 4지지 지장간 정기 (일간=자기 제외)
  const tally=[0,0,0,0,0];
  [c.year.stem,c.month.stem,c.hour?.stem].forEach(s=>{if(s!=null)tally[group(dm,s)]++;});
  // 지지는 지장간 정기로 집계 (실제 명리 방식)
  const hb=[c.hiddenStems.year[0],c.hiddenStems.month[0],c.hiddenStems.day[0],...(c.hiddenStems.hour?[c.hiddenStems.hour[0]]:[])];
  hb.forEach(s=>tally[group(dm,s)]++);
  const strong=c.strength.verdict;

  const overview:Section={
    title:"Your Day Master",
    verdict:`${DM_PERSONA[dmE].t} · ${strong==="strong"?"Strong":strong==="weak"?"Weak":"Balanced"} chart`,
    body:`${nm}, your Saju is anchored by a <b>${DM_PERSONA[dmE].t}</b> day master — you are ${DM_PERSONA[dmE].p} `+
      (strong==="strong"?"Your chart runs <b>strong</b>: you have fuel to burn, so your challenge is restraint, not effort."
       :strong==="weak"?"Your chart runs <b>weak</b>: your power comes in alliances and timing, not brute force — choose your battles."
       :"Your chart is <b>balanced</b>: rare and enviable — you bend without breaking.")+
      ` Your strongest element is <b>${ELEM_EN[c.elements.strongest]}</b>`+
      (c.elements.missing.length?`, and you are missing <b>${c.elements.missing.map(i=>ELEM_EN[i]).join(" & ")}</b> — a key to your luck (below).`:".")
  };

  const personality:Section={
    title:"Who You Are",
    verdict:GROUP_EN[argmax(tally)].split(" ")[0]+" type",
    body:`Your chart leans toward <b>${GROUP_EN[argmax(tally)]}</b>. `+
      [`You define yourself by independence and rivalry — you'd rather lead than follow.`,
       `You think by creating: expression, ideas and output are how you process the world.`,
       `You are wired for results and resources — practical, and quietly ambitious about money.`,
       `You respect structure and responsibility — duty shapes you, sometimes too much.`,
       `You are fed by learning and support — knowledge, mentors and depth steady you.`][argmax(tally)]
  };

  // 재물운: 재성(group2) 양 + 신강신약
  const wealthStar=tally[2];
  const wealth:Section={
    title:"Wealth",
    verdict: wealthStar===0?"Indirect wealth path":wealthStar>=3?(strong==="weak"?"Money stress (재다신약)":"Strong wealth pull"):"Steady wealth",
    body: wealthStar===0
      ? `You carry little direct Wealth star — money rarely comes by chasing it. Your fortune arrives <b>through your talent and reputation</b> (your Output element), not through hustle. Build a name, and money follows.`
      : (strong==="weak" && wealthStar>=3)
      ? `You have heavy Wealth stars but a <b>weak</b> day master — the classic <b>재다신약</b> ("rich chart, thin self"). Opportunity is everywhere, but spreading thin drains you. Your wealth year comes when you <b>partner up</b> and stop carrying it all alone.`
      : `Your Wealth stars are ${wealthStar>=3?"strong":"present"} and your self is ${strong==="weak"?"building":"capable"} — you can <b>hold</b> what you earn. Your money grows fastest through ${strong==="strong"?"bold, decisive moves":"disciplined, compounding habits"}.`
  };

  // 연애·결혼: 배우자 별(남=재성2, 여=관성3) + 일지(배우자궁)
  const spouseGroup = (opts.gender==="F")?3:2;
  const spouseStar=tally[spouseGroup];
  const dayBranchElem=BRANCH_ELEM[c.day.branch];
  const love:Section={
    title:"Love & Marriage",
    verdict: spouseStar===0?"Love comes late but real":spouseStar>=3?"Magnetic, many options":"Healthy partnership luck",
    body: `Your Spouse Palace (the branch under your day) is <b>${ELEM_EN[dayBranchElem]}</b>, which means in love you seek `+
      [`growth and shared ideals — a partner who lets you lead but plants their own roots.`,
       `warmth and passion — someone who matches your fire without smothering it.`,
       `safety and loyalty — a steady soul you can build a life on.`,
       `respect and sharpness — a partner who challenges your mind, not just your heart.`,
       `depth and understanding — someone who reads the storm under your calm.`][dayBranchElem]+
      ` `+(spouseStar===0
        ? `Your Spouse star is quiet — love arrives <b>later, but lasts</b>. You marry on your own timing, not the crowd's.`
        : spouseStar>=3
        ? `Your Spouse star is <b>strong</b> — you draw admirers easily. The risk is choice, not chance: pick depth over options.`
        : `Your Spouse star is well-placed — <b>steady, mutual partnership</b> is written into your chart.`)
  };

  // 직업: 우세 십성
  const dom=argmax(tally);
  const career:Section={
    title:"Career & Calling",
    verdict:["Independent / founder","Creative / expert maker","Business / finance","Organization / leadership","Knowledge / advisory"][dom],
    body:`Your dominant force is <b>${GROUP_EN[dom]}</b>, so you thrive as a `+
      [`<b>founder or independent operator</b> — you wither under bosses and bloom on your own name.`,
       `<b>creator, performer or specialist maker</b> — careers where your output IS the product.`,
       `<b>builder of wealth — business, sales, finance, real assets</b> — you turn effort into money.`,
       `<b>leader inside a structure — management, law, public roles</b> — you carry responsibility well.`,
       `<b>expert, advisor, academic or healer</b> — depth and knowledge are your currency.`][dom]
  };

  // 2026 세운 = 丙午年 (丙 stem=2, 午 fire). 일간 대비 십성으로 테마.
  const yearStem2026=2; // 丙
  const g26=group(dm,yearStem2026);
  const year2026:Section={
    title:"Your 2026 (Year of the Fire Horse 丙午)",
    verdict:["A year of self & rivals","A year of output & visibility","A year of money & opportunity","A year of duty & pressure","A year of support & learning"][g26],
    body:`2026 is the <b>Fire Horse</b> year, and to your ${ELEM_EN[dmE]} day master it activates <b>${GROUP_EN[g26]}</b>. `+
      [`This is a year to <b>back yourself</b> — independence, new ventures, and reclaiming your own lane. Allies matter; rivals appear.`,
       `Your <b>visibility spikes</b> — create, publish, perform, launch. The world is unusually ready to watch you in 2026.`,
       `<b>Money moves toward you</b> — deals, raises, side income. Strike while the Fire burns; don't sit on the opportunity.`,
       `A year of <b>weight and structure</b> — responsibility, commitment, maybe a title or a vow. Heavy, but it builds your foundation.`,
       `A year of <b>refilling</b> — study, mentors, rest, real estate, and deepening. Plant now; the harvest is 2027.`][g26]+
      (c.daeun?` You enter this year within your <b>${c.daeun.list.find(d=>d.age<=36)?.gzKR||c.daeun.list[0].gzKR}</b> luck cycle.`:``)
  };

  const miss=c.elements.missing[0]??c.elements.weakest;
  const luck:Section={
    title:"Your Luck Keys",
    verdict:`Restore ${ELEM_EN[miss]}`,
    body:`Your chart is hungry for <b>${ELEM_EN[miss]}</b>. Feed it and your luck steadies. `+
      `Lucky color: <b>${REMEDY[miss].color}</b> · Direction: <b>${REMEDY[miss].dir}</b> · Numbers: <b>${REMEDY[miss].num}</b>. `+
      `Lean these into your home, your phone case, the seat you choose — small signals, real shift.`
  };

  return {overview,personality,wealth,love,career,year2026,luck,tally};
}
function argmax(a:number[]):number{let mi=0;for(let i=1;i<a.length;i++)if(a[i]>a[mi])mi=i;return mi;}
