const B="http://localhost:8912";
async function up(){for(let i=0;i<25;i++){try{const r=await fetch(B+"/api/saju/teaser?y=1994&m=7&d=22");if(r.status<500)return;}catch{}await new Promise(f=>setTimeout(f,300));}}
const J=async(p:string,o?:any)=>{const r=await fetch(B+p,o);return {s:r.status,b:await r.json().catch(()=>({}))};};
let pass=0,fail=0;const ok=(n:string,c:boolean,x="")=>{console.log(`${c?"✅":"❌"} ${n} ${x}`);c?pass++:fail++;};
// 비동기 모듈: pending이면 폴링
async function getModule(ID:string,mod:string){for(let i=0;i<30;i++){const r=await J("/api/reading/"+ID+"/module/"+mod);
  if(r.b.content)return r.b.content; if(r.b.needsPhoto)return {needsPhoto:true}; if(r.s===402)return {locked:true};
  if(r.s===202||r.b.pending){await new Promise(f=>setTimeout(f,2000));continue;} return {error:r.s};} return {timeout:true};}
await up();

const co=await J("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({y:1994,m:7,d:22,h:14,min:30,g:"F",name:"Emma",email:"emma@example.com"})});
ok("checkout core -> /r/:id", co.s===200 && /^\/r\//.test(co.b.url), co.b.url);
const ID=co.b.url.split("/r/")[1];
let meta=await J("/api/reading/"+ID);
ok("needs name + names + 己酉", meta.b.needName===true && meta.b.names?.length>=3 && meta.b.pillars.day==="己酉");
ok("modules incl palm(addon)", meta.b.modules.some((m:any)=>m.id==="palm" && m.addon));

// 이름 → 코어 프리워밍 시작
await J("/api/reading/"+ID+"/name",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kr:"은하"})});
console.log("…core (async prewarm + poll)");
const core=await getModule(ID,"core");
ok("core 7 sections (async)", core.sections?.length===7);
// 재열람 캐시 동일
const core2=await J("/api/reading/"+ID+"/module/core");
ok("re-view core cached identical", JSON.stringify(core)===JSON.stringify(core2.b.content));

// 애드온 잠금 → 해금(프리워밍) → 12개월
ok("monthly locked", (await J("/api/reading/"+ID+"/module/monthly_2026")).s===402);
await J("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({module:"monthly_2026",readingId:ID})});
const mon=await getModule(ID,"monthly_2026");
ok("monthly 12 months (async)", mon.sections?.length===12);

// B) 손금: 해금 → needsPhoto → 사진 업로드 → 콘텐츠
ok("palm locked before unlock", (await J("/api/reading/"+ID+"/module/palm")).s===402);
await J("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({module:"palm",readingId:ID})});
const palmMeta=await J("/api/reading/"+ID+"/module/palm");
ok("palm unlocked -> needsPhoto", palmMeta.b.needsPhoto===true);
const tinyPng="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
console.log("…palm vision upload");
const palm=await J("/api/reading/"+ID+"/palm",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({image:tinyPng,mime:"image/png"})});
ok("palm returns content (vision or graceful)", palm.s===200 && palm.b.content?.sections?.length>=1);

// 보안 회귀
ok("/my gated", (await J("/api/my?email=emma@example.com")).s===403);
ok("db.ts not served", (await fetch(B+"/db.ts")).status===404);
ok("ksaju.db not served", (await fetch(B+"/ksaju.db")).status===404);

console.log(`\ncore overview: ${(core.sections?.[0]?.body||"").slice(0,120)}…`);
console.log(`palm: ${(palm.b.content?.sections?.[0]?.body||"").slice(0,120)}…`);
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
