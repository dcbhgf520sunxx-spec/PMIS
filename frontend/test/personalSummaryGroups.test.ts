import test from 'node:test';
import assert from 'node:assert/strict';
import { personalSummaryGroups, personalProductBrief } from '../src/modules/digital-twin/components/personalSummaryGroups.ts';
test('简报先按产品再按项目主题归并，同名项目和产品以ID隔离且不截断',()=>{
 const rows=Array.from({length:8},(_,i)=>({sourceIds:[`tasks:${i}`],productId:String(i%2),productName:'同名产品',projectId:String(i),topic:'同名项目',text:`进展${i}`}));
 const groups=personalSummaryGroups([...rows,rows[0],{...rows[0],text:'补充进展'}]);
 assert.equal(groups.length,2);assert.equal(groups[0].topics.length,4);assert.deepEqual(groups[0].topics[0].texts,['进展0','补充进展']);
 assert.equal(groups.flatMap(g=>g.topics).length,8);
});
test('未提供产品归属时明确显示，不把主题推断为项目',()=>{
 const group=personalSummaryGroups([{sourceIds:['tasks:1'],topic:'运行保障',text:'处理访问问题'}])[0];
 assert.equal(group.name,'未关联／未授权产品');assert.equal(group.topics[0].name,'运行保障');
});

test('简报以产品为首层，进展与关注在同一产品内对照，保留单侧事项及所有主题',()=>{
 const item=(productId:string,projectId:string,text:string)=>({productId,productName:'同名产品',projectId,topic:'项目'+projectId,text,sourceIds:[text]});
 const products=personalProductBrief({progress:[item('1','a','已完成验证'),item('2','b','已有进展')],priorities:[item('2','b','准备上线')],concerns:[item('1','a','等待样本'),item('3','c','解决阻塞'),item('2','b','准备上线')]});
 assert.equal(products.length,3);
 assert.deepEqual(products.map(p=>p.key),['1','2','3']);
 assert.equal(products[0].progress[0].texts[0],'已完成验证');
 assert.equal(products[0].attention[0].texts[0],'等待样本');
 assert.deepEqual(products[1].attention[0].texts,['准备上线']);
 assert.equal(products[2].progress.length,0);assert.equal(products[2].attention.length,1);
 assert.deepEqual(personalProductBrief({progress:[],priorities:[],concerns:[]}),[]);
});
