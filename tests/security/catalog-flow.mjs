import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
export async function catalogFlow({api,adminToken,studentToken,admin,origin,db}){
  const base={description:'بيانات وهمية للاختبار فقط',parentId:'',programId:'',order:0,lessonDate:'',published:true,progressEnabled:false,version:''};
  const save=(body,token=adminToken)=>api('/api/admin/catalog',token,body);
  assert.equal((await save({...base,id:'fake',kind:'program',title:'ممنوع'},studentToken)).status,403);
  assert.equal((await save({...base,id:'program-local',kind:'program',title:'برنامج اختبار محلي'})).status,200);
  for(const [kind,id,parentId] of [['subject','subject-local',''],['book','book-local','subject-local'],['series','series-local','book-local'],['lesson','lesson-local','series-local']]){
    assert.equal((await save({...base,id,kind,parentId,programId:'program-local',title:`${kind} محلي للاختبار`})).status,200);
  }
  assert.equal((await save({...base,id:'invalid-parent',kind:'lesson',programId:'program-local',parentId:'subject-local',title:'درس غير صالح'})).status,409);
  const rows=await (await api('/api/admin/catalog?kind=lesson',adminToken)).json();
  const lesson=rows.entries.find(e=>e.id==='lesson-local');
  assert.equal((await save({...lesson,title:'عنوان معدل',published:false})).status,200);
  assert.equal((await save({...lesson,title:'تحديث قديم'})).status,409);
  assert.equal((await db.doc('catalog/lesson-local').get()).data().published,false);
  assert.equal((await api('/api/settings',studentToken,{timeZone:'UTC'})).status,403);
  assert.equal((await api('/api/settings',adminToken,{timeZone:'invalid/zone'})).status,400);
  assert.equal((await api('/api/settings',adminToken,{timeZone:'UTC'})).status,200);
  assert.equal((await (await fetch(origin+'/api/settings')).json()).timeZone,'UTC');
  await admin.goto(origin+'/admin/content');
  await expect(admin.getByRole('heading',{name:'البرامج والمواد العلمية'})).toBeVisible();
  await admin.getByRole('button',{name:'إنشاء برنامج',exact:true}).click();
  await admin.getByLabel('العنوان',{exact:true}).fill('برنامج من واجهة الاختبار');
  await admin.getByRole('button',{name:'حفظ المحتوى',exact:true}).click();
  await expect(admin.getByRole('heading',{name:'برنامج من واجهة الاختبار'})).toBeVisible();
  await admin.setViewportSize({width:390,height:844});
  assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.ok((await db.collection('admissionAudit').where('action','==','catalog-create').get()).size>=6);
}
