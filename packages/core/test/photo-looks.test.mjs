import test from 'node:test';
import assert from 'node:assert/strict';
import {PHOTO_LOOKS,focusRaster,photoCropRect,editPhoto,feedbackUrl} from '../dist/index.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';

const source={width:5,height:4,pixels:Uint8ClampedArray.from({length:80},(_,i)=>i%4===3?i===3?79:255:(i*71+23)%256)};
const options={rect:{x:0,y:0,width:5,height:4},method:'crop',tolerance:0};
test('fourteen authored looks are distinct, deterministic, alpha preserving and leave the source untouched',()=>{
 const before=source.pixels.slice(),outputs=new Set();assert.equal(PHOTO_LOOKS.length-1,14);
 for(const look of PHOTO_LOOKS){const next=focusRaster(source,{...options,adjustments:{filter:look.id}});assert.deepEqual(next,focusRaster(source,{...options,adjustments:{filter:look.id}}));outputs.add(Buffer.from(next.pixels).toString('hex'));for(let i=3;i<80;i+=4)assert.equal(next.pixels[i],source.pixels[i]);}
 assert.equal(outputs.size,PHOTO_LOOKS.length);assert.deepEqual(source.pixels,before);
 assert.deepEqual(focusRaster(source,options).pixels,source.pixels);
 const neutral={width:1,height:1,pixels:Uint8ClampedArray.from([128,128,128,79])};
 assert.deepEqual([...focusRaster(neutral,{rect:{x:0,y:0,width:1,height:1},method:'crop',tolerance:0,adjustments:{filter:'marigold'}}).pixels],[146,132,112,79],'independent neutral-pixel golden for warmth, contrast and split tint');
 assert.throws(()=>focusRaster(source,{...options,adjustments:{filter:'invented'}}),/adjustment/);
});
test('a colour grade survives editable photo export and reopen exactly',()=>{
 const workspace=new PhotoWorkspace([source],true);workspace.append({kind:'tone',options:{...options,adjustments:{filter:'neon-rain'}}},'Neon rain');
 const expected=workspace.renderFirst(),reopened=new PhotoWorkspace([source]);reopened.restore(decodePhotoProject(encodePhotoProject(workspace.snapshot())));
 assert.deepEqual(reopened.renderFirst(),expected);workspace.undoEdit();assert.deepEqual(workspace.renderFirst(),source);
});
test('crop guide geometry matches retained pixels including custom ratios and edge positioning',()=>{
 const image={width:12,height:8,pixels:Uint8ClampedArray.from({length:384},(_,i)=>i%4===3?255:Math.floor(i/4)%256)};
 const crop={kind:'crop',ratio:1,zoom:1,x:.5,y:.5};assert.deepEqual(photoCropRect(12,8,crop),{x:2,y:0,width:8,height:8});
 const next=editPhoto(image,crop);assert.equal(next.pixels[0],2);assert.equal(next.pixels[8*4],14);
 const custom={...crop,ratio:7/3,zoom:2,x:1,y:1},rect=photoCropRect(12,8,custom),result=editPhoto(image,custom);
 assert.equal(rect.x+rect.width,12);assert.equal(rect.y+rect.height,8);assert.equal(result.width,rect.width);assert.equal(result.height,rect.height);assert.equal(result.pixels[0],rect.y*12+rect.x);
 assert.throws(()=>photoCropRect(12,8,{...crop,ratio:0}));
});
test('feedback stays local until configured and builds only permitted form links with explicit prefills',()=>{
 assert.equal(feedbackUrl('issue','EzPix Android'),null);
 const url=new URL(feedbackUrl('feature','EzPIX Insta',{url:'https://docs.google.com/forms/d/e/example/viewform',typeEntry:'entry.123',appEntry:'entry.456'}));
 assert.equal(url.searchParams.get('entry.123'),'Request a feature');assert.equal(url.searchParams.get('entry.456'),'EzPIX Insta');assert.equal([...url.searchParams].length,2);
 for(const url of ['javascript:alert(1)','https://evil.example/forms/','https://docs.google.com.evil.example/forms/','https://docs.google.com/document/x'])assert.throws(()=>feedbackUrl('issue','EzPix website',{url,typeEntry:'',appEntry:''}));
});
