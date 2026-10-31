import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesPopupReturn} from '../toolbar-popup.js';

test('a capture return restores only its exact tab/window before expiry',()=>{
 const record={tabId:7,windowId:3,expires:2000},source={tabId:7,windowId:3};
 assert.equal(matchesPopupReturn(record,source,1000),true);
 for(const wrong of [{tabId:8,windowId:3},{tabId:7,windowId:4},{tabId:'7',windowId:3},{tabId:7},null])assert.equal(matchesPopupReturn(record,wrong,1000),false);
 for(const wrong of [null,{...record,expires:1000},{...record,expires:NaN},{...record,expires:Infinity}])assert.equal(matchesPopupReturn(wrong,source,1000),false);
});
