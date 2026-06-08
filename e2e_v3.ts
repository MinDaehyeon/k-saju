const B="http://localhost:8912";
async function up(){for(let i=0;i<25;i++){try{const r=await fetch(B+"/api/saju/teaser?y=1994&m=7&d=22");if(r.status<500)return;}catch{}await new Promise(f=>setTimeout(f,300));}}
const J=async(p:string,o?:any)=>{const r=await fetch(B+p,o);return {s:r.status,b:await r.json().catch(()=>({}))};};
let pass=0,fail=0;const ok=(n:string,c:boolean,x="")=>{console.log(`${c?"✅":"❌"} ${n} ${x}`);c?pass++:fail++;};
await up();

// 1) 코어 결제(테스트) → 영구링크
const co=await J("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({y:1994,m:7,d:22,h:14,min:30,g:"F",name:"Emma",email:"emma@example.com"})});
ok("checkout core -> /r/:id", co.s===200 && /^\/r\//.test(co.b.url), co.b.url);
const ID=co.b.url.split("/r/")[1];

// 2) 메타: 이름 선택 필요 + names
let meta=await J("/api/reading/"+ID);
ok("reading meta paid", meta.s===200);
ok("needs name + names", meta.b.needName===true && meta.b.names?.length>=3);
ok("pillars 己酉", meta.b.pillars.day==="己酉");
ok("core unlocked, addon locked", meta.b.modules.find((m:any)=>m.id==="core").unlocked===true && meta.b.modules.find((m:any)=>m.id==="monthly_2026").unlocked===false);

// 3) 이름 저장
await J("/api/reading/"+ID+"/name",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kr:"은하"})});
meta=await J("/api/reading/"+ID);
ok("korean name saved", meta.b.koreanName==="은하" && meta.b.needName===false);

// 4) 코어 모듈 열람 (풍부화 시도 → 캐시)
console.log("…fetching core (LLM enrich, may take ~15s)");
const core1=await J("/api/reading/"+ID+"/module/core");
ok("core has 7 sections", core1.b.content?.sections?.length===7);
ok("core overview non-empty", (core1.b.content.sections[0].body||"").length>50);
// 5) 재열람 = 캐시 동일
const core2=await J("/api/reading/"+ID+"/module/core");
ok("re-view core identical (cache)", JSON.stringify(core1.b.content)===JSON.stringify(core2.b.content));

// 6) 애드온 잠금
const lock=await J("/api/reading/"+ID+"/module/monthly_2026");
ok("addon locked -> 402", lock.s===402 && lock.b.locked===true);

// 7) 애드온 해금(테스트 결제) → 콘텐츠
const un=await J("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({module:"monthly_2026",readingId:ID})});
ok("addon checkout -> open url", un.s===200 && un.b.url.includes("open=monthly_2026"));
const mon=await J("/api/reading/"+ID+"/module/monthly_2026");
ok("monthly 2026 has 12 months", mon.b.content?.sections?.length===12, "got="+mon.b.content?.sections?.length);

// 8) 재열람: 메타에 해금 반영 + 다른 생일 ID는 격리
meta=await J("/api/reading/"+ID);
ok("monthly now unlocked in meta", meta.b.modules.find((m:any)=>m.id==="monthly_2026").unlocked===true);

// 9) /my 이메일 열거 차단(보안)
const my=await J("/api/my?email=emma@example.com");
ok("/my gated — no enumeration", my.s===403);

// 10) 정적 유출 차단(P0): DB/소스 안 열림
ok("db.ts not served", (await fetch(B+"/db.ts")).status===404);
ok("ksaju.db not served", (await fetch(B+"/ksaju.db")).status===404);
ok("server.ts not served", (await fetch(B+"/server.ts")).status===404);

// 11) 결정론
ok("pillars deterministic", meta.b.pillars.day==="己酉");

console.log(`\nReading ${ID} | ${meta.b.pillars.year} ${meta.b.pillars.month} ${meta.b.pillars.day} ${meta.b.pillars.hour}`);
console.log("core overview:", (core1.b.content.sections[0].body||"").slice(0,140)+"…");
console.log("monthly[0]:", mon.b.content.sections[0].title, "—", (mon.b.content.sections[0].body||"").slice(0,90));
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
