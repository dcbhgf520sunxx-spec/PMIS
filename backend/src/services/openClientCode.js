// 复用既有主键序列，并发分配不重复；跳过历史手工编码，已发出的编码不改写。
async function allocateOpenClientCode(db) {
  for (;;) {
    const {id} = await db.prepare("SELECT nextval(pg_get_serial_sequence('pms_open_client','id')) AS id").get()
    const code = `SYS${String(id).padStart(6,'0')}`
    if (!await db.prepare('SELECT id FROM pms_open_client WHERE code=?').get(code)) return {id,code}
  }
}
module.exports = {allocateOpenClientCode}
