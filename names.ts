// ============================================================
// Korean Name Generator — 결정론적. 발음 echo + 사주 보완 오행(작명 원리).
//  같은 (이름, 사주) => 항상 같은 후보. 라이브: AI가 발음 매칭을 더 풍부하게.
// ============================================================
import { SajuChart, ELEM_EN } from "./saju.ts";

// 풀: [한글, 로마자, 한자, 뜻(EN), 오행 idx(木0火1土2金3水4)]
const POOL:[string,string,string,string,number][] = [
  ["하준","Ha-jun","河俊","river of talent",4],["서우","Seo-u","抒雨","gentle rain",4],
  ["은하","Eun-ha","銀河","the galaxy / silver river",4],["해미","Hae-mi","海美","beauty of the sea",4],
  ["지호","Ji-ho","志澔","vast ambition",4],["민서","Min-seo","旼抒","bright & graceful",1],
  ["예나","Ye-na","藝娜","graceful & artful",0],["수아","Su-a","秀娥","elegant excellence",0],
  ["지우","Ji-u","智宇","wise universe",2],["하늘","Ha-neul","—","the sky",2],
  ["도윤","Do-yun","道潤","path of grace",2],["라온","Ra-on","—","joyful (pure Korean)",1],
  ["선재","Seon-jae","善才","virtuous talent",3],["시현","Si-hyun","始賢","first wisdom",3],
  ["유진","Yu-jin","裕珍","precious abundance",3],["다온","Da-on","—","all good things come",1],
  ["윤서","Yun-seo","潤抒","graceful flow",4],["가온","Ga-on","—","center of the world",2],
];
// 흔한 영어이름 -> 발음 echo 후보(한글). 없으면 결정론적 풀 선택.
const ECHO:Record<string,string[]> = {
  emma:["은하","예나","해미"], emily:["에린","예린","유미"], olivia:["오린","유리아","리아"],
  sophia:["소피","서아","수아"], mia:["미아","민아","리아"], ava:["아라","에바","아린"],
  isabella:["이서","벨라","세라"], grace:["가은","그레","서연"], chloe:["클로","고은","유리"],
  james:["재민","제이","진우"], john:["조한","준","건"], michael:["민결","마이","현우"],
  david:["대원","다윗","도윤"], daniel:["다니","단우","대건"], ethan:["이든","에단","이안"],
  jack:["재익","잭","진"], leo:["리오","이오","레온"], noah:["노아","나우","호아"],
};
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);}

export interface NameOpt{ kr:string; ro:string; hanja:string; meaning:string; elem:number; elemName:string; restoresMissing:boolean; }

export function generateNames(realName:string, chart:SajuChart):NameOpt[]{
  const key=realName.trim().toLowerCase().replace(/[^a-z]/g,"");
  const missArr = chart.elements.missing.length?chart.elements.missing:[chart.elements.weakest];
  const missSet = new Set(missArr);
  const miss = missArr[0];
  const h=hash(key||"anon");
  // POOL 항목을 한글로 찾는 helper
  const find=(kr:string)=>POOL.find(p=>p[0]===kr);
  const out:NameOpt[]=[];
  const push=(p:[string,string,string,string,number]|undefined, kr?:string)=>{
    if(p) out.push({kr:p[0],ro:p[1],hanja:p[2],meaning:p[3],elem:p[4],elemName:ELEM_EN[p[4]],restoresMissing:missSet.has(p[4])});
    else if(kr) out.push({kr,ro:romanize(kr),hanja:"—",meaning:"a name that echoes yours",elem:miss,elemName:ELEM_EN[miss],restoresMissing:true});
  };
  // 1) 발음 echo가 있으면 우선 (한자/뜻 있으면 POOL 정보 사용)
  const echo=ECHO[key];
  if(echo){ echo.forEach(kr=>push(find(kr),kr)); }
  // 2) 사주 보완: 부족한 오행의 이름을 결정론적으로 하나 보장
  if(!out.some(o=>o.restoresMissing)){
    const cand=POOL.filter(p=>missSet.has(p[4])); if(cand.length) push(cand[h%cand.length]);
  }
  // 3) 3개 채우기(결정론적, 중복 없이)
  let i=0;
  while(out.length<3 && i<POOL.length*2){ const p=POOL[(h+i)%POOL.length]; if(!out.some(o=>o.kr===p[0])) push(p); i++; }
  return out.slice(0,3);
}
function romanize(kr:string){ // 데모용 간이 로마자 (라이브: 정식 변환 라이브러리)
  return kr;
}
