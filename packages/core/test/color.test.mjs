import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rgbToHsv,hsvToHex} from '../dist/index.js';
test('HSV primaries, grayscale and RGB round trips preserve exact channels',()=>{
  assert.equal(hsvToHex(0,100,100),'#ff0000');assert.equal(hsvToHex(120,100,100),'#00ff00');assert.equal(hsvToHex(240,100,100),'#0000ff');assert.equal(hsvToHex(360,100,100),'#ff0000');assert.equal(hsvToHex(72,0,100),'#ffffff');assert.equal(hsvToHex(220,100,0),'#000000');
  for(const r of [0,1,33,128,254,255])for(const g of [0,17,192,255])for(const b of [0,64,255]){const {h,s,v}=rgbToHsv(r,g,b);assert.equal(hsvToHex(h,s,v),'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''));}
  for(const bad of [-1,256,NaN,1.5])assert.throws(()=>rgbToHsv(bad,0,0));for(const hsv of [[361,0,0],[0,-1,0],[0,0,101],[NaN,0,0]])assert.throws(()=>hsvToHex(...hsv));
});
