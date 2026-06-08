import { computeSaju } from "./saju.ts";
import { buildReading } from "./reading.ts";
import { enrichReading, factsText } from "./enrich.ts";

const c = computeSaju({year:1994,month:7,day:22,hour:14,minute:30,gender:"F"});
const r = buildReading(c,{name:"Emma",koreanName:"은하",gender:"F"});
const facts = factsText(c);
console.log("ANTHROPIC key present:", !!process.env.ANTHROPIC_API_KEY);
console.log("\n— FACTS given to LLM —\n"+facts);

const sections = {overview:r.overview,personality:r.personality,wealth:r.wealth,love:r.love,career:r.career,year2026:r.year2026,luck:r.luck};
console.time("enrich");
const enriched = await enrichReading(facts, sections, {name:"Emma",koreanName:"은하"});
console.timeEnd("enrich");

if(!enriched){ console.log("❌ enrich returned null (no key or error) — template fallback would be used"); process.exit(1); }
let ok=true;
for(const k of ["overview","wealth","love","year2026"] as const){
  const base=sections[k].body.replace(/<\/?b>/g,""); const rich=enriched[k]||"";
  const longer = rich.length > base.length*1.1;
  console.log(`\n[${k}] base ${base.length} chars -> rich ${rich.length} chars  ${longer?"✅":"⚠"}`);
  console.log("RICH:", rich);
  if(!rich) ok=false;
}
// 사실 보존 체크(간단): 일간 Earth, 2026 Fire Horse 언급 유지/모순 없음
console.log("\nfacts-preservation spot check: mentions 'Earth'?", /earth/i.test(enriched.overview||""), " | 2026 fire?", /fire|horse|2026/i.test(enriched.year2026||""));
console.log(ok?"\n=== enrich OK ===":"\n=== enrich FAIL ===");
