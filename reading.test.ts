import { computeSaju } from "./saju.ts";
import { buildReading } from "./reading.ts";

let pass=0,fail=0;
const ok=(n:string,c:boolean)=>{console.log(`${c?"✅":"❌"} ${n}`);c?pass++:fail++;};

const emma=computeSaju({year:1994,month:7,day:22,hour:14,minute:30,gender:"F"});
const r=buildReading(emma,{name:"Emma",koreanName:"은하",gender:"F"});

ok("all 7 sections present", !!(r.overview&&r.personality&&r.wealth&&r.love&&r.career&&r.year2026&&r.luck));
ok("bodies non-empty", [r.overview,r.wealth,r.love,r.career,r.year2026].every(s=>s.body.length>40));
// determinism
const a=JSON.stringify(buildReading(emma,{name:"Emma",koreanName:"은하",gender:"F"}));
const b=JSON.stringify(buildReading(emma,{name:"Emma",koreanName:"은하",gender:"F"}));
ok("reading deterministic", a===b);

function dump(label:string,bd:any,name:string,kor:string){
  const c=computeSaju(bd); const rr=buildReading(c,{name,koreanName:kor,gender:bd.gender});
  console.log(`\n══ ${label} (${kor}) ══  사주 ${c.year.gz} ${c.month.gz} ${c.day.gz} ${c.hour?.gz} · 신강신약:${c.strength.verdict} · 십성분포[비겁식상재관인]:${rr.tally}`);
  for(const k of ["overview","wealth","love","career","year2026","luck"] as const){
    const s=(rr as any)[k]; console.log(`\n[${s.title}] (${s.verdict})\n${s.body.replace(/<\/?b>/g,"")}`);
  }
}
dump("Emma 1994-07-22 14:30 F",{year:1994,month:7,day:22,hour:14,minute:30,gender:"F"},"Emma","은하");
dump("Sample male 1988-11-03 07:20",{year:1988,month:11,day:3,hour:7,minute:20,gender:"M"},"Jake","재현");

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
