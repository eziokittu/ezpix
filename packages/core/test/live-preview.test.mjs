import test from 'node:test';
import assert from 'node:assert/strict';
import {createLivePreview} from '../dist/live-preview.js';

function fixture(){let input={size:1},next=0,restores=0;const jobs=new Map(),states=[],shown=[],saved=[];
 const session=createLivePreview({read:()=>input,preview:value=>{if(!Number.isFinite(value.size)||value.size<=0)throw Error('Invalid size');shown.push(value);},apply:value=>saved.push(value),cancel:()=>restores++,state:value=>states.push(value),schedule:callback=>{jobs.set(++next,callback);return next;},unschedule:()=>{}});
 return {session,jobs,shown,saved,states,set size(value){input.size=value;},get restores(){return restores;}};
}
test('Apply commits exactly the successful visible edit once and never reads changed controls',()=>{
 const f=fixture();assert.equal(f.session.apply(),false);f.session.request(true);assert.deepEqual(f.shown,[{size:1}]);f.size=2;assert.equal(f.session.apply(),true);assert.deepEqual(f.saved,[{size:1}]);assert.equal(f.session.apply(),false);
});
test('rapid control events coalesce and queued edits cannot survive Cancel or disposal',()=>{
 const f=fixture();f.session.request();const stale=f.jobs.get(1);f.size=2;f.session.request();assert.equal(f.session.apply(),false);stale();assert.equal(f.shown.length,0);f.jobs.get(2)();assert.deepEqual(f.shown,[{size:2}]);f.session.request();f.session.cancel();f.jobs.get(3)();assert.equal(f.shown.length,1);assert.equal(f.restores,1);assert.equal(f.session.apply(),false);f.session.request();f.session.dispose();f.jobs.get(4)();assert.equal(f.shown.length,1);
});
test('invalid edits disable Apply without committing the last valid preview; explicit flush uses latest input',()=>{
 const f=fixture();f.session.request(true);f.size=NaN;f.session.request(true);assert.equal(f.session.apply(),false);assert.match(f.states.at(-1).error,/Invalid/);assert.equal(f.saved.length,0);f.size=3;f.session.request();assert.equal(f.session.flush(),true);assert.deepEqual(f.saved,[{size:3}]);f.jobs.get(1)();assert.equal(f.shown.length,2,'the canceled pending frame cannot reappear after saving');
});
