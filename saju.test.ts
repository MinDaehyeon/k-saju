import { computeSaju, STEMS, BRANCHES } from "./saju.ts";

let pass=0, fail=0;
function eq(name:string, got:any, exp:any){
  const ok = got===exp;
  console.log(`${ok?"✅":"❌"} ${name}: got=${got} exp=${exp}`);
  ok?pass++:fail++;
}

// 1) 일주 앵커: 2000-01-01 = 戊午 (검증된 만세력 사실)
eq("day pillar 2000-01-01", computeSaju({year:2000,month:1,day:1,hour:12,minute:0}).day.gz, "戊午");
// 추가 일주 앵커: 1984-02-02 ... JDN 연속성 체크 (하루 차이 = 다음 간지)
const d1=computeSaju({year:2024,month:6,day:15,hour:12,minute:0}).day;
const d2=computeSaju({year:2024,month:6,day:16,hour:12,minute:0}).day;
eq("day pillar advances by 1 (stem)", (d2.stem-d1.stem+10)%10, 1);
eq("day pillar advances by 1 (branch)", (d2.branch-d1.branch+12)%12, 1);

// 2) 년주: 입춘 이후
eq("year 1984 (mid)", computeSaju({year:1984,month:6,day:15,hour:12,minute:0}).year.gz, "甲子");
eq("year 2024 (mid)", computeSaju({year:2024,month:6,day:15,hour:12,minute:0}).year.gz, "甲辰");
eq("year 2020 (mid)", computeSaju({year:2020,month:6,day:15,hour:12,minute:0}).year.gz, "庚子");
// 입춘 경계: 2024-01-15 은 아직 癸卯(2023)년
eq("year before ipchun 2024-01-15 -> 癸卯", computeSaju({year:2024,month:1,day:15,hour:12,minute:0}).year.gz, "癸卯");
// 입춘 직후(대략 2/5)은 甲辰
eq("year after ipchun 2024-02-10 -> 甲辰", computeSaju({year:2024,month:2,day:10,hour:12,minute:0}).year.gz, "甲辰");

// 3) 오호둔 월간 규칙: 甲년 寅월 => 丙寅
//   2024-02-10 (입춘 직후 寅월), 甲辰년 => 월주 丙寅
eq("month pillar 甲year 寅month -> 丙寅", computeSaju({year:2024,month:2,day:10,hour:12,minute:0}).month.gz, "丙寅");

// 4) 오서둔 시간 규칙: 甲일 子시 => 甲子시
//   일간이 甲인 날을 찾아 자시로 테스트
function findDayStem(target:number){ // 0=甲
  for(let d=1;d<=30;d++){const c=computeSaju({year:2024,month:6,day:d,hour:0,minute:30});if(c.day.stem===target)return {y:2024,m:6,d};}
  return null;
}
const gapDay=findDayStem(0)!;
const hourC=computeSaju({year:gapDay.y,month:gapDay.m,day:gapDay.d,hour:0,minute:30});
eq("hour stem on 甲-day at 子-hour starts 甲", hourC.hour!.stem, 0);
eq("hour branch at 00:30 (true solar) is 子", hourC.hour!.branch, 0);

// 5) 결정론: 같은 입력 => 같은 출력
const a=JSON.stringify(computeSaju({year:1990,month:6,day:15,hour:14,minute:30}));
const b=JSON.stringify(computeSaju({year:1990,month:6,day:15,hour:14,minute:30}));
eq("deterministic", a===b, true);

// 6) 대운: 성별 주면 생성 + 나이 단조 증가
const wg=computeSaju({year:1990,month:6,day:15,hour:9,minute:10,gender:"M"});
eq("daeun exists for gender", wg.daeun!==null, true);
eq("daeun ages ascend", wg.daeun!.list[1].age>wg.daeun!.list[0].age, true);
eq("daeun startAge >= 0", wg.daeun!.startAge>=0, true);
// 7) 신강신약 verdict 유효
eq("strength verdict valid", ["strong","balanced","weak"].includes(computeSaju({year:1994,month:7,day:22,hour:14,minute:30}).strength.verdict), true);
// 8) 지장간 존재
eq("hidden stems present", computeSaju({year:1994,month:7,day:22,hour:14,minute:30}).hiddenStems.month.length>0, true);
// 9) 음력 입력은 막혀야 함(조용히 틀리면 안 됨)
let lunarGuard=false; try{ computeSaju({year:1994,month:7,day:22,hour:14,minute:30,calendar:"lunar"} as any);}catch(e){lunarGuard=true;}
eq("lunar input throws (no silent wrong)", lunarGuard, true);

// ---- 샘플 차트 출력 (눈으로 확인) ----
function show(label:string,bd:any){
  const c=computeSaju(bd);
  console.log(`\n── ${label} ──`);
  console.log(`사주: 년 ${c.year.gz}(${c.year.gzKR})  월 ${c.month.gz}  일 ${c.day.gz}  시 ${c.hour?.gz??"-"}`);
  console.log(`일간(Day Master): ${STEMS[c.dayMaster]} / element idx ${c.dayMasterElem}`);
  console.log(`오행분포 [木火土金水]: ${c.elements.count.join(",")}  missing:${c.elements.missing}  strongest:${c.elements.strongest}`);
  console.log(`십성: 년 ${c.tenGods.year} / 월 ${c.tenGods.month} / 시 ${c.tenGods.hour}`);
  console.log(`띠(zodiac branch idx): ${c.zodiac}  진태양시(min): ${c.trueSolarMinutes}  황경:${c.meta.solarLongitude}`);
}
show("Emma 1994-07-22 14:30 Seoul",{year:1994,month:7,day:22,hour:14,minute:30});
show("Sample 1990-06-15 09:10 Seoul",{year:1990,month:6,day:15,hour:9,minute:10});

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
