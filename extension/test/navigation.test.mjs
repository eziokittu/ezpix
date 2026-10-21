import {test} from 'node:test';import assert from 'node:assert/strict';import {waitForTabReady} from '../navigation.js';
function event(){const listeners=new Set();return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),emit:(...args)=>{for(const f of listeners)f(...args);},get size(){return listeners.size;}};}
test('handoff initialization handles already-ready, delayed, closed and timed-out tabs and cleans listeners',async()=>{
  for(const mode of ['ready','delayed','closed','timeout']){const tabs={onUpdated:event(),onRemoved:event(),get:async()=>({status:mode==='ready'?'complete':'loading'})},pending=waitForTabReady(3,tabs,mode==='timeout'?1:1000);
    if(mode==='delayed'){tabs.onUpdated.emit(2,{status:'complete'});tabs.onUpdated.emit(3,{status:'complete'});}if(mode==='closed')tabs.onRemoved.emit(3);
    if(mode==='closed'||mode==='timeout')await assert.rejects(pending,/Destination tab/);else await pending;
    assert.equal(tabs.onUpdated.size,0);assert.equal(tabs.onRemoved.size,0);
  }
});
