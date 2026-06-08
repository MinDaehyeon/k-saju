// D 검증: 웹훅 HMAC 서명 + intent 기반 grant (라이브 키 불필요, WEBHOOK_SECRET만)
import { createHmac } from "node:crypto";
import * as db from "./db.ts";
const SEC="testsecret"; const B="http://localhost:8913";
let pass=0,fail=0;const ok=(n:string,c:boolean,x="")=>{console.log(`${c?"✅":"❌"} ${n} ${x}`);c?pass++:fail++;};

const id=db.createReading({year:1990,month:1,day:1,hour:12,minute:0,name:"WH"},"wh@x.com",0);
const intent=db.createIntent(id,"monthly_2026");
const payload=JSON.stringify({meta:{event_name:"order_created",event_id:"evt_"+Date.now(),custom_data:{intent}},data:{id:"ord_1",attributes:{status:"paid",store_id:""}}});
const sig=createHmac("sha256",SEC).update(payload).digest("hex");

const bad=await fetch(B+"/api/webhook",{method:"POST",headers:{"X-Signature":"deadbeef","X-Event-Name":"order_created","content-type":"application/json"},body:payload});
ok("bad signature rejected (400)", bad.status===400, "got="+bad.status);
ok("not granted after bad sig", db.hasModule(id,"monthly_2026")===false);

const good=await fetch(B+"/api/webhook",{method:"POST",headers:{"X-Signature":sig,"X-Event-Name":"order_created","content-type":"application/json"},body:payload});
ok("valid signature accepted (200)", good.status===200, "got="+good.status);
ok("module granted via intent", db.hasModule(id,"monthly_2026")===true);
ok("reading marked paid", db.getReading(id)?.paid===1);

// 멱등: 같은 event 재전송 → 중복 처리 안 함(이미 grant됨, 에러 없음)
const again=await fetch(B+"/api/webhook",{method:"POST",headers:{"X-Signature":sig,"X-Event-Name":"order_created","content-type":"application/json"},body:payload});
ok("idempotent replay ok (200)", again.status===200);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
