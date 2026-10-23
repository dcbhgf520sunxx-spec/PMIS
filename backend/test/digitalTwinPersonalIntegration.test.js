const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const integration = process.env.PERSONAL_TWIN_INTEGRATION === '1' || process.env.RUN_DB_INTEGRATION === '1';
const schema = `personal_twin_test_${crypto.randomBytes(6).toString('hex')}`;
if (integration) process.env.DB_OPTIONS = `-c search_path=${schema} -c timezone=Asia/Shanghai`;

test('个人数字孪生真实数据库及HTTP：本人限定、责任去重、操作证据与权限隔离', { skip: !integration }, async () => {
    const db = require('../src/db');
    let server;
    try {
        await db.pool.query(`CREATE SCHEMA ${schema}`);
        await db.exec(fs.readFileSync(path.join(__dirname, '../db/init/001_schema.sql'), 'utf8').replace(/^ALTER (DATABASE|ROLE).*$/gm, ''));
        const user = await db.prepare('SELECT id,employee_no,real_name FROM pms_user WHERE id=1').get();
        await db.prepare('UPDATE pms_user SET first_login=0 WHERE id=?').run(user.id);
        const other = (await db.prepare("INSERT INTO pms_user(employee_no,real_name,phone,password,status,first_login) VALUES('personal-other','其他人员','13800009999','unused',1,0)").run()).lastInsertRowid;
        const product = (await db.prepare("INSERT INTO pms_product(name,owner_id,status) VALUES('个人测试产品',?,1)").run(other)).lastInsertRowid;
        const project = (await db.prepare("INSERT INTO pms_project(name,product_id,owner_id,status,expected_end_date) VALUES('参与项目',?,?,1,CURRENT_DATE+2)").run(product, other)).lastInsertRowid;
        await db.prepare('INSERT INTO pms_project_member(project_id,user_id) VALUES(?,?)').run(project, user.id);
        const archive = await db.prepare('SELECT id FROM pms_archive WHERE is_deleted=0 ORDER BY id LIMIT 1').get();
        const createTask = async (name, owner, parent) => {
            const task = (await db.prepare('INSERT INTO pms_task(name,source_type,project_id,task_type,priority,status,parent_task_id,expected_end_date) VALUES(?,1,?,?,2,1,?,CURRENT_DATE-1)').run(name, project, archive.id, parent || null)).lastInsertRowid;
            await db.prepare('INSERT INTO pms_task_owner(task_id,user_id) VALUES(?,?) RETURNING task_id').run(task, owner);
            return task;
        };
        const mine = await createTask('本人任务', user.id);
        const theirs = await createTask('他人任务不能混入', other);
        await db.prepare('INSERT INTO pms_task_owner(task_id,user_id) VALUES(?,?) RETURNING task_id').run(mine, other);
        const parent = await createTask('关闭主任务', other);
        await db.prepare("UPDATE pms_task SET status=4,close_date=CURRENT_DATE,close_reason='测试关闭' WHERE id=?").run(parent);
        const child = await createTask('上级关闭子任务', user.id, parent);
        const stage = (await db.prepare("INSERT INTO pms_project_plan_stage(project_id,name,sort_order) VALUES(?,'测试阶段',20)").run(project)).lastInsertRowid;
        const item = (await db.prepare("INSERT INTO pms_project_plan_item(stage_id,name,owner_id,status,original_due_date,current_due_date,sort_order) VALUES(?,'协作事项',?,1,CURRENT_DATE+2,CURRENT_DATE+2,20)").run(stage, other)).lastInsertRowid;
        await db.prepare('INSERT INTO pms_project_plan_item_collaborator(plan_item_id,user_id) VALUES(?,?) RETURNING plan_item_id').run(item, user.id);
        const earlierStage = (await db.prepare("INSERT INTO pms_project_plan_stage(project_id,name,sort_order) VALUES(?,'先行阶段',10)").run(project)).lastInsertRowid;
        const earlierItem = (await db.prepare("INSERT INTO pms_project_plan_item(stage_id,name,owner_id,status,original_due_date,current_due_date,sort_order) VALUES(?,'先行事项',?,1,CURRENT_DATE+1,CURRENT_DATE+1,10)").run(earlierStage, other)).lastInsertRowid;
        const laterItem = (await db.prepare("INSERT INTO pms_project_plan_item(stage_id,name,owner_id,status,original_due_date,current_due_date,sort_order) VALUES(?,'阶段内前置事项',?,1,CURRENT_DATE+3,CURRENT_DATE+3,10)").run(stage, other)).lastInsertRowid;
        for (const id of [earlierItem,laterItem]) await db.prepare('INSERT INTO pms_project_plan_item_collaborator(plan_item_id,user_id) VALUES(?,?) RETURNING plan_item_id').run(id,user.id);
        const operation = crypto.randomUUID();
        for (const [field, value] of [['description', '不返回原始描述'], ['status', '2']]) await db.prepare("INSERT INTO pms_op_log(user_id,action,module,target_id,operation_id,field_name,new_value) VALUES(?,'状态变更','任务',?,?,?,?)").run(user.id, mine, operation, field, value);
        await db.prepare("INSERT INTO pms_op_log(user_id,action,module,target_id,operation_id,field_name,new_value,created_at) VALUES(?,'状态变更','任务',?,?,'status','1',NOW()-INTERVAL '1 hour')").run(user.id, mine, crypto.randomUUID());
        await db.prepare("INSERT INTO pms_follow_up_record(task_id,content,creator_id) VALUES(?,'已完成接口联调，待验证异常分支',?)").run(mine, user.id);
        await db.prepare("INSERT INTO pms_follow_up_record(task_id,content,creator_id) VALUES(?,'他人补充内容不能算成本人工作',?)").run(mine, other);
        await db.prepare("INSERT INTO pms_op_log(user_id,action,module,target_id) VALUES(?,'新增阶段','项目阶段主计划',?)").run(user.id, item);
        const { currentPersonalSnapshot } = require('../src/services/digitalTwinPersonalService');
        const snapshot = await currentPersonalSnapshot(user.id);
        assert.equal(snapshot.person.id, String(user.id));
        assert.deepEqual(snapshot.records.filter(r=>r.kind==='planItems').map(r=>r.id),[earlierItem,laterItem,item].map(String));
        assert.equal(snapshot.records.filter(r => r.kind==='tasks' && r.id===String(mine)).length, 1);
        assert.ok(!snapshot.records.some(r => r.kind==='tasks' && r.id===String(theirs)));
        assert.equal(snapshot.records.find(r => r.kind==='projects' && r.id===String(project)).relationship, 'participant');
        assert.equal(snapshot.records.find(r => r.kind==='planItems' && r.id===String(item)).relationship, 'collaborator');
        assert.ok(!snapshot.priorities.some(r => r.id===String(child) && r.kind==='tasks'));
        assert.equal(snapshot.events.filter(e => e.kind==='tasks' && e.recordId===String(mine)).length, 2);
        assert.ok(snapshot.events.some(e => e.action==='状态变更为已完成'));
        assert.ok(!snapshot.events.some(e => e.action==='新增阶段'));
        assert.ok(!JSON.stringify(snapshot).includes('不返回原始描述'));
        assert.ok(snapshot.records.find(r => r.kind==='tasks' && r.id===String(mine)).progressNote.endsWith('已完成接口联调，待验证异常分支'));
        assert.ok(!JSON.stringify(snapshot).includes('他人补充内容不能算成本人工作'));
        const evidence = require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(snapshot);
        assert.ok(JSON.stringify(evidence).includes('已完成接口联调，待验证异常分支'));
        await db.prepare("UPDATE pms_follow_up_record SET content='已补齐异常分支测试',updated_at=NOW() WHERE task_id=? AND creator_id=?").run(mine, user.id);
        assert.notEqual((await currentPersonalSnapshot(user.id)).summaryRevision, snapshot.summaryRevision);
        // 产品视角必须保留项目边界、阶段及事项的手工顺序，不能跨项目按 sort_order 混排。
        const secondProject = (await db.prepare("INSERT INTO pms_project(name,product_id,owner_id,status,expected_end_date) VALUES('另一项目',?,?,1,CURRENT_DATE+5)").run(product, other)).lastInsertRowid;
        const secondStage = (await db.prepare("INSERT INTO pms_project_plan_stage(project_id,name,sort_order) VALUES(?,'另项目阶段',0)").run(secondProject)).lastInsertRowid;
        const secondItem = (await db.prepare("INSERT INTO pms_project_plan_item(stage_id,name,owner_id,status,original_due_date,current_due_date,sort_order) VALUES(?,'另项目事项',?,0,CURRENT_DATE+5,CURRENT_DATE+5,0)").run(secondStage, other)).lastInsertRowid;
        const contracts = [];
        for (const projectId of [project, secondProject]) {
            contracts.push((await db.prepare("INSERT INTO pms_project_contract(project_id,contract_code,contract_name,supplier_id,signed_date,contract_amount) VALUES(?,?,'排序合同',1,CURRENT_DATE,100)").run(projectId, `order-test-${projectId}`)).lastInsertRowid);
        }
        const paymentStages = [];
        for (const [contractId, sortOrder] of [[contracts[0],20],[contracts[0],10],[contracts[1],0]])
            paymentStages.push((await db.prepare("INSERT INTO pms_project_payment_stage(contract_id,stage_name,planned_amount,sort_order) VALUES(?,?,10,?)").run(contractId, `排序付款阶段${sortOrder}`, sortOrder)).lastInsertRowid);
        const productSnapshot = await require('../src/services/digitalTwinService').currentSnapshot(user.id, product);
        const productIds = kind => productSnapshot.records.filter(r => r.kind === kind).map(r => r.id);
        assert.deepEqual(productIds('planStages'), [earlierStage,stage,secondStage].map(String));
        assert.deepEqual(productIds('planItems'), [earlierItem,laterItem,item,secondItem].map(String));
        assert.deepEqual(productIds('paymentStages'), [paymentStages[1],paymentStages[0],paymentStages[2]].map(String));
        const app = require('express')(); app.use(require('express').json());
        app.use('/api/digital-twin', require('../src/middleware/auth').verifyToken, require('../src/middleware/checkPermission').checkPermission('/digital-twin'), require('../src/routes/digitalTwin'));
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        const origin = `http://127.0.0.1:${server.address().port}/api/digital-twin/personal`;
        assert.equal((await fetch(origin)).status, 401);
        const sessionId = await require('../src/services/accessLogService').recordLoginSuccess({ user, account: user.employee_no, req: { headers: {}, ip: '127.0.0.1' } });
        const token = require('jsonwebtoken').sign({ userId:Number(user.id), employeeNo:user.employee_no, sessionId }, process.env.JWT_SECRET || 'PMIS-dev-secret', { expiresIn: '5m' });
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal((await fetch(origin, { headers })).status, 200);
        const periodPayload=await (await fetch(origin,{headers})).json();
        assert.ok(periodPayload.data.period.startDate.endsWith('-01'));
        const periodEvidence=require('../src/services/digitalTwinAiSummary').buildPersonalSummaryEvidence(periodPayload.data);
        const ownEvidence=periodEvidence.work.find(r=>r.sourceId===`tasks:${mine}`);
        assert.equal(ownEvidence.productId,String(product));assert.equal(ownEvidence.projectId,String(project));assert.equal(ownEvidence.projectName,'参与项目');
        for(const group of periodPayload.data.groups){
            const rows=periodPayload.data.records.filter(r=>r.kind===group.kind&&r.relationship==='responsible');
            assert.equal(group.completion.knownIncluded,rows.filter(r=>r.included===true).length);
            assert.equal(group.completion.knownCompleted,rows.filter(r=>r.included===true&&r.completed===true).length);
        }
        assert.equal((await fetch(`${origin}?startDate=2026-02-30&endDate=2026-03-01`,{headers})).status,400);
        assert.equal((await fetch(`${origin}?startDate=2026-10-01`,{headers})).status,400);
        const historical=await (await fetch(`${origin}?startDate=2026-01-01&endDate=2026-01-31`,{headers})).json();
        assert.equal(historical.data.period.observationDate,'2026-01-31');
        assert.equal(historical.data.records.length,0);

        const selected = await (await fetch(`${origin}?personId=${other}`, { headers })).json();
        assert.equal(selected.code, 0);
        assert.equal(selected.data.person.id, String(other));
        assert.ok(selected.data.records.some(r => r.kind==='tasks' && r.id===String(theirs)));
        assert.ok(!selected.data.records.some(r => r.kind==='tasks' && r.id===String(child)));
        assert.ok(selected.data.records.some(r => r.kind==='projects' && r.relationship==='responsible'));
        assert.ok(selected.data.records.some(r => r.progressNote.endsWith('他人补充内容不能算成本人工作')));
        assert.ok(!selected.data.events.some(e => e.action==='状态变更为已完成'));
        assert.equal((await fetch(`${origin}?userId=${other}`, { headers })).status, 400);
        assert.equal((await fetch(`${origin}?personId=0`, { headers })).status, 400);
        assert.equal((await fetch(`${origin}?personId=900000000`, { headers })).status, 404);
        assert.equal((await fetch(`${origin}/summary`, { method:'POST',headers:{ ...headers,'Content-Type':'application/json' },body:JSON.stringify({ userId:other }) })).status, 400);
        await db.prepare("DELETE FROM pms_role_menu WHERE menu_id IN (SELECT id FROM pms_menu WHERE path='/products')").run();
        const limited = await (await fetch(origin, { headers })).json();
        assert.ok(!JSON.stringify(limited).includes('个人测试产品'));
        assert.ok(limited.data.records.every(r => r.productId===''));
        await db.prepare("DELETE FROM pms_role_menu WHERE menu_id IN (SELECT id FROM pms_menu WHERE path='/projects')").run();
        const selectedLimited = await (await fetch(`${origin}?personId=${other}`, { headers })).json();
        assert.ok(!selectedLimited.data.records.some(r => r.kind==='projects' || r.kind==='planItems'));
        assert.ok(!JSON.stringify(selectedLimited).includes('参与项目'));
        assert.ok(selectedLimited.data.records.some(r => r.kind==='tasks'));
        await db.prepare("DELETE FROM pms_role_menu WHERE menu_id IN (SELECT id FROM pms_menu WHERE path='/digital-twin')").run();
        assert.equal((await fetch(origin, { headers })).status, 403);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await db.pool.end();
    }
});
