// ============================================================
// LLM 풍부화 (Anthropic). 결정론 사주 '사실'을 받아 *바꾸지 않고* 깊게 narrate.
//  결과는 DB module_cache에 저장 → 재열람 시 동일(일관성). 키 없으면 null(템플릿 폴백).
// ============================================================
import type { SajuChart } from "./saju.ts";
import { STEMS, BRANCHES, ELEM_EN, ANIMALS, STEM_ELEM, STEM_YANG } from "./saju.ts";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KSAJU_LLM_MODEL || "claude-sonnet-4-6";
const GKEY = process.env.GEMINI_API_KEY;
const GMODELS = (process.env.KSAJU_GEMINI_MODEL || "gemini-2.5-flash,gemini-2.5-flash-lite").split(",");
export const enrichEnabled = !!(KEY || GKEY);

const SYSTEM = `You are a master Korean Saju (사주명리) reader writing a PREMIUM, personalized reading in English for a global client who paid for depth.
HARD RULES:
- You are GIVEN the exact computed chart facts + base interpretations. NARRATE them richly. NEVER invent or contradict a fact (pillars, day master element, strength, ten-gods, missing elements, 2026 relation).
- Keep each section's intent. Rewrite each BODY to 4–7 vivid, warm, concrete second-person sentences. Mystical yet grounded; specific, never generic horoscope filler.
- Address the client warmly in the second person ("you", "your"). Do NOT print their Korean name in Hangul.
- Write ONLY in natural, fluent English. NEVER output Korean (Hangul) or Chinese (hanja) characters, and do NOT drop in romanized jargon or technical term codes in parentheses (no "(비겁)", no "丙午", no "Gyeong-o"). The client cannot read Korean — translate every concept into plain English.
- Output STRICT JSON ONLY (no prose around it), using the SAME keys you were given:
  {"sections":{"<key>":{"body":"..."}, ...}}`;

// 차트 -> 모델이 어길 수 없는 '사실' 텍스트
export function factsText(c: SajuChart): string {
  // 영어로만 — LLM이 한글/한자를 따라쓰지 못하게 raw 간지·gzKR·한자는 넣지 않는다.
  const pil = (x:any)=> x? `${STEM_YANG[x.stem]?"Yang":"Yin"} ${ELEM_EN[STEM_ELEM[x.stem]]} over the ${ANIMALS[x.branch]}`:"unknown";
  return [
    `Four Pillars (energy over zodiac animal): Year = ${pil(c.year)}; Month = ${pil(c.month)}; Day = ${pil(c.day)}; Hour = ${c.hour?pil(c.hour):"unknown"}`,
    `Day Master (core self): ${ELEM_EN[c.dayMasterElem]}`,
    `Overall strength: ${c.strength.verdict}`,
    `Five-element balance [Wood, Fire, Earth, Metal, Water] = ${c.elements.count.join(", ")}; missing: ${c.elements.missing.map(i=>ELEM_EN[i]).join(", ")||"none"}; strongest: ${ELEM_EN[c.elements.strongest]}`,
    `Birth zodiac animal: ${ANIMALS[c.zodiac]}`,
    `The year 2026 is the Fire Horse year.`,
    c.daeun? `Major luck cycles move ${c.daeun.direction === "forward" ? "forward" : "in reverse"}, beginning around age ${c.daeun.startAge}.`:"",
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
    body:JSON.stringify({model:MODEL,max_tokens:4096,temperature:0.7,
      system:[{type:"text",text:SYSTEM,cache_control:{type:"ephemeral"}}],
      messages:[{role:"user",content:user}]})});
  if(!res.ok){ console.error("[enrich:anthropic]",res.status,(await res.text()).slice(0,160)); return null; }
  const j:any=await res.json(); return parseSections(j.content?.[0]?.text||"");
}
async function callGemini(user:string):Promise<Record<string,string>|null>{
  const body=JSON.stringify({system_instruction:{parts:[{text:SYSTEM}]},
    contents:[{role:"user",parts:[{text:user}]}],
    generationConfig:{temperature:0.7,maxOutputTokens:8192,responseMimeType:"application/json"}});
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
// 손금/관상 — Gemini Vision. 이미지+프롬프트 → 리딩 텍스트 | null
export async function enrichVision(b64:string, mime:string, prompt:string):Promise<string|null>{
  if(!GKEY) return null;
  for(const model of GMODELS){
    for(let a=0;a<2;a++){
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${model.trim()}:generateContent?key=${GKEY}`;
      const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},{inline_data:{mime_type:mime,data:b64}}]}],
          generationConfig:{temperature:0.85,maxOutputTokens:1400}})});
      if(res.ok){ const j:any=await res.json(); const t=j.candidates?.[0]?.content?.parts?.[0]?.text||""; if(t) return t; break; }
      const s=res.status; console.error("[vision]",model,s,(await res.text()).slice(0,120));
      if(s===503||s===429){ await new Promise(f=>setTimeout(f,1200*(a+1))); continue; } break;
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
