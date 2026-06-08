// ============================================================
// LLM 풍부화 (Anthropic). 결정론 사주 '사실'을 받아 *바꾸지 않고* 깊게 narrate.
//  결과는 DB module_cache에 저장 → 재열람 시 동일(일관성). 키 없으면 null(템플릿 폴백).
// ============================================================
import type { SajuChart } from "./saju.ts";
import { STEMS, BRANCHES, ELEM_EN, ANIMALS } from "./saju.ts";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KSAJU_LLM_MODEL || "claude-sonnet-4-6";
const GKEY = process.env.GEMINI_API_KEY;
const GMODELS = (process.env.KSAJU_GEMINI_MODEL || "gemini-2.5-flash,gemini-2.5-flash-lite").split(",");
export const enrichEnabled = !!(KEY || GKEY);

const SYSTEM = `You are a master Korean Saju (사주명리) reader writing a PREMIUM, personalized reading in English for a global client who paid for depth.
HARD RULES:
- You are GIVEN the exact computed chart facts + base interpretations. NARRATE them richly. NEVER invent or contradict a fact (pillars, day master element, strength, ten-gods, missing elements, 2026 relation).
- Keep each section's intent. Rewrite each BODY to 4–7 vivid, warm, concrete second-person sentences. Mystical yet grounded; specific, never generic horoscope filler.
- Refer to the client by their chosen Korean name when natural.
- Output STRICT JSON ONLY (no prose around it), using the SAME keys you were given:
  {"sections":{"<key>":{"body":"..."}, ...}}`;

// 차트 -> 모델이 어길 수 없는 '사실' 텍스트
export function factsText(c: SajuChart): string {
  const p = (x:any)=> x? `${STEMS[x.stem]}${BRANCHES[x.branch]} (${x.gzKR})`:"-";
  return [
    `Four Pillars: Year ${p(c.year)} / Month ${p(c.month)} / Day ${p(c.day)} / Hour ${c.hour?p(c.hour):"unknown"}`,
    `Day Master: ${STEMS[c.dayMaster]} = ${ELEM_EN[c.dayMasterElem]}`,
    `Strength: ${c.strength.verdict} (score ${c.strength.score})`,
    `Five Elements count [Wood,Fire,Earth,Metal,Water]: ${c.elements.count.join(",")}; missing: ${c.elements.missing.map(i=>ELEM_EN[i]).join(",")||"none"}; strongest: ${ELEM_EN[c.elements.strongest]}`,
    `Ten Gods: year=${c.tenGods.year}, month=${c.tenGods.month}, hour=${c.tenGods.hour}`,
    `Zodiac (year branch): ${ANIMALS[c.zodiac]}`,
    `2026 is 丙午 (Fire Horse).`,
    c.daeun? `Luck cycle (Dae-un) ${c.daeun.direction}, starts age ${c.daeun.startAge}; first cycles: ${c.daeun.list.slice(0,4).map(d=>d.gzKR+"@"+d.age).join(", ")}`:"",
  ].filter(Boolean).join("\n");
}

function buildUser(facts:string, sections:Record<string,{title:string;verdict:string;body:string}>, opts:{name?:string;koreanName?:string}):string{
  return `CLIENT: ${opts.name||"the client"}${opts.koreanName?` (Korean name: ${opts.koreanName})`:""}\n\n`+
    `CHART FACTS (must not contradict):\n${facts}\n\n`+
    `BASE SECTIONS to enrich (keep meaning, rewrite each body deeper):\n${JSON.stringify(
      Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,{verdict:v.verdict,base:v.body.replace(/<\/?b>/g,"")}]))
    )}`;
}
function parseSections(txt:string):Record<string,string>|null{
  const m=txt.match(/\{[\s\S]*\}/); if(!m) return null;
  try{ const p=JSON.parse(m[0]); if(!p.sections) return null;
    const out:Record<string,string>={}; for(const [k,v] of Object.entries<any>(p.sections)) out[k]=(v.body||v||"").toString();
    return Object.keys(out).length? out: null;
  }catch{ return null; }
}
async function callAnthropic(user:string):Promise<Record<string,string>|null>{
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"x-api-key":KEY!,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({model:MODEL,max_tokens:2200,temperature:0.7,
      system:[{type:"text",text:SYSTEM,cache_control:{type:"ephemeral"}}],
      messages:[{role:"user",content:user}]})});
  if(!res.ok){ console.error("[enrich:anthropic]",res.status,(await res.text()).slice(0,160)); return null; }
  const j:any=await res.json(); return parseSections(j.content?.[0]?.text||"");
}
async function callGemini(user:string):Promise<Record<string,string>|null>{
  const body=JSON.stringify({system_instruction:{parts:[{text:SYSTEM}]},
    contents:[{role:"user",parts:[{text:user}]}],
    generationConfig:{temperature:0.7,maxOutputTokens:2400,responseMimeType:"application/json"}});
  for(const model of GMODELS){ // 모델 순회
    for(let attempt=0;attempt<2;attempt++){ // 5xx/429 재시도(지연 한도)
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${model.trim()}:generateContent?key=${GKEY}`;
      const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body});
      if(res.ok){ const j:any=await res.json(); const out=parseSections(j.candidates?.[0]?.content?.parts?.[0]?.text||""); if(out) return out; break; }
      const status=res.status; const t=(await res.text()).slice(0,120);
      console.error(`[enrich:gemini] ${model} ${status} ${t}`);
      if(status===503||status===429){ await new Promise(f=>setTimeout(f,1200*(attempt+1))); continue; } // 일시적 → 재시도
      break; // 그 외(400 등)는 다음 모델로
    }
  }
  return null;
}
// sections: {key:{title,verdict,body}} => {key: enrichedBody} | null. Anthropic 우선, 실패 시 Gemini.
export async function enrichReading(
  facts:string, sections:Record<string,{title:string;verdict:string;body:string}>, opts:{name?:string;koreanName?:string}
): Promise<Record<string,string>|null>{
  const user=buildUser(facts,sections,opts);
  if(KEY){ try{ const r=await callAnthropic(user); if(r) return r; }catch(e){ console.error("[enrich:anthropic]",e); } }
  if(GKEY){ try{ const r=await callGemini(user); if(r) return r; }catch(e){ console.error("[enrich:gemini]",e); } }
  return null;
}
