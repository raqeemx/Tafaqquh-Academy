import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
test('deployment fails closed and default project is emulator-only',()=>{
  assert.equal(spawnSync(process.execPath,['scripts/block-deploy.mjs']).status,1);
  assert.equal(JSON.parse(fs.readFileSync('.firebaserc','utf8')).projects.default,'demo-tafaqquh');
  const config=JSON.parse(fs.readFileSync('firebase.json','utf8'));
  for(const product of ['firestore','storage'])assert.deepEqual(config[product].predeploy,['node scripts/block-deploy.mjs']);
});
