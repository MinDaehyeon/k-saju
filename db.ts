// ============================================================
// K-Saju persistence (Bun SQLite). 주문·리딩 영구저장 → 매직링크로 재열람.
//  프로덕션 서버리스(Vercel)는 파일DB 휘발 → Turso/libSQL/Postgres로 교체(README).
// ============================================================
import { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";

const PATH = process.env.KSAJU_DB || (import.meta.dir + "/ksaju.db");
const db = new Database(PATH);
db.run("PRAGMA journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS readings(
  id TEXT PRIMARY KEY,
  email TEXT,
  birth_json TEXT NOT NULL,
  korean_name TEXT,
  enriched_json TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,
  created_at INTEGER NOT NULL,
  last_viewed INTEGER
)`);
db.run(`CREATE TABLE IF NOT EXISTS events( event_id TEXT PRIMARY KEY, at INTEGER )`);
db.run(`CREATE INDEX IF NOT EXISTS idx_readings_email ON readings(email)`);
// 모듈별 해금(애드온 업셀) + 모듈 콘텐츠 캐시(재열람 일관성)
db.run(`CREATE TABLE IF NOT EXISTS entitlements(
  reading_id TEXT, module TEXT, order_id TEXT, created_at INTEGER,
  PRIMARY KEY(reading_id, module) )`);
db.run(`CREATE TABLE IF NOT EXISTS module_cache(
  reading_id TEXT, module TEXT, json TEXT,
  PRIMARY KEY(reading_id, module) )`);

export const newId = () => randomBytes(18).toString("base64url"); // 추측불가 매직링크

export interface ReadingRow{ id:string; email:string|null; birth_json:string; korean_name:string|null;
  enriched_json:string|null; paid:number; order_id:string|null; created_at:number; last_viewed:number|null; }

export function createReading(birth:any, email?:string, paid=0, orderId?:string):string{
  const id=newId();
  db.run(`INSERT INTO readings(id,email,birth_json,paid,order_id,created_at) VALUES(?,?,?,?,?,?)`,
    [id, email??null, JSON.stringify(birth), paid?1:0, orderId??null, Date.now()]);
  return id;
}
export function getReading(id:string):ReadingRow|null{
  return db.query(`SELECT * FROM readings WHERE id=?`).get(id) as any ?? null;
}
export function touchViewed(id:string){ db.run(`UPDATE readings SET last_viewed=? WHERE id=?`,[Date.now(),id]); }
export function setKoreanName(id:string,kr:string){ db.run(`UPDATE readings SET korean_name=? WHERE id=?`,[kr,id]); }
export function setEnriched(id:string,json:string){ db.run(`UPDATE readings SET enriched_json=? WHERE id=?`,[json,id]); }
export function markPaidByOrder(readingId:string, orderId:string){ db.run(`UPDATE readings SET paid=1, order_id=? WHERE id=?`,[orderId,readingId]); }
export function listByEmail(email:string):ReadingRow[]{
  return db.query(`SELECT * FROM readings WHERE email=? AND paid=1 ORDER BY created_at DESC LIMIT 50`).all(email) as any;
}
// 웹훅 멱등 (check / mark 분리 — grant 성공 후 mark)
export function hasEvent(eventId:string):boolean{ return !!db.query(`SELECT 1 FROM events WHERE event_id=?`).get(eventId); }
export function markEvent(eventId:string){ db.run(`INSERT OR IGNORE INTO events(event_id,at) VALUES(?,?)`,[eventId,Date.now()]); }
export function clearModuleCache(readingId:string){ db.run(`DELETE FROM module_cache WHERE reading_id=?`,[readingId]); }
// 모듈 해금/조회
export function grantModule(readingId:string, module:string, orderId?:string){
  db.run(`INSERT OR IGNORE INTO entitlements(reading_id,module,order_id,created_at) VALUES(?,?,?,?)`,[readingId,module,orderId??null,Date.now()]);
}
export function entitlements(readingId:string):string[]{
  return (db.query(`SELECT module FROM entitlements WHERE reading_id=?`).all(readingId) as any[]).map(r=>r.module);
}
export function hasModule(readingId:string, module:string):boolean{
  return !!db.query(`SELECT 1 FROM entitlements WHERE reading_id=? AND module=?`).get(readingId,module);
}
// 모듈 콘텐츠 캐시(풍부화 결과 — 재열람 시 동일 보장)
export function getModuleCache(readingId:string, module:string):any|null{
  const r:any=db.query(`SELECT json FROM module_cache WHERE reading_id=? AND module=?`).get(readingId,module);
  return r? JSON.parse(r.json): null;
}
export function setModuleCache(readingId:string, module:string, obj:any){
  db.run(`INSERT OR REPLACE INTO module_cache(reading_id,module,json) VALUES(?,?,?)`,[readingId,module,JSON.stringify(obj)]);
}
