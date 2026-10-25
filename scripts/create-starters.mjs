// Original authored pixel rows. Offline asset authoring, never a runtime generator.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDocument,PixelEditor,hexColor,encodeProject,decodeProject,composite} from '../packages/core/dist/index.js';
const output=resolve('../glitchbong/public/ezpix/starters');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),catalog=[];
const ink={n:'#19253d',b:'#344b70',c:'#7cb9c9',w:'#fff0c7',y:'#ffc05c',o:'#ed743c',r:'#a43f3b',g:'#375941',l:'#8bab60',d:'#293d3b',p:'#d694b9',t:'#715144',s:'#9d7552'};
function rows(editor,pattern,x=0,y=0){for(const [dy,row]of pattern.entries())for(const [dx,key]of [...row].entries())if(key!=='.'){if(!ink[key])throw new Error('Unknown authored colour');editor.paint(x+dx,y+dy,hexColor(ink[key]));}editor.commit();}
async function asset(id,name,description,doc){
 doc.activeFrameId=doc.frames[0].id;doc.activeLayerId=doc.layers.at(-1).id;const editor=new PixelEditor(doc);editor.setPalette(Object.values(ink));const text=encodeProject(doc);decodeProject(text);
 const rgba=[...composite(doc)],png=await page.evaluate(({rgba,w,h})=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);return c.toDataURL('image/png').split(',')[1];},{rgba,w:doc.width,h:doc.height});
 await writeFile(resolve(output,id+'.ezpix'),text);await writeFile(resolve(output,id+'.png'),Buffer.from(png,'base64'));catalog.push({id,name,description,width:doc.width,height:doc.height,layers:doc.layers.length,frames:doc.frames.length,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
}
try{
 const lantern=new PixelEditor(createDocument(16,16,'Lantern'));lantern.renameLayer('Frame');
 rows(lantern,['......nnnn......','.....nbbbbn.....','.....nb..bn.....','......nnnn......','....nnbbbbn.....','...nbcccccbbn...','...nb......bn...','...nb......bn...','...nb......bn...','...nb......bn...','...nb......bn...','...nb......bn...','....nbbbbbbn....','....nnccc cnn....'.replace(' ',''),'.....nbbbbn.....','......nnnn......']);
 lantern.addLayer();lantern.renameLayer('Flame');rows(lantern,['....y...','...ywy..','...ywy..','..ywwyo.','..ywwyo.','...yyo..','..rrrr..'],4,5);
 await asset('lantern','Lantern','Light a small lantern. Edit its frame and flame separately.',lantern.document);
 const orbit=new PixelEditor(createDocument(24,24,'Orbit loop'));orbit.renameLayer('Stars');
 const stars=['..c.....................','..............w.........','....................c...','........................','......w.................','........................','........................','......................w.','........................','........................','........................','........................','........................','........................','........................','........................','.c......................','........................','........................','.....................c..','.....w..................','........................','...............w........','........................'];rows(orbit,stars);
 orbit.addLayer();orbit.renameLayer('Planet');rows(orbit,['....nnnn....','..nnbbbbnn..','.nbbccbbcbn.','nbbcccccbbbn','nbccwwcccbbn','nbccwccccc bn'.replace(' ',''),'nbbccccccbbn','.nbbccccbbn.','..nnbbbbnn..','....nnnn....'],6,7);
 orbit.addLayer();orbit.renameLayer('Moon');const moon=['.ooo.','oywyo','oywyo','.ooo.'];const poses=[[16,3],[18,10],[7,18],[2,8]];
 for(let f=0;f<4;f++){if(f){orbit.selectLayer(orbit.document.layers[0].id);orbit.addFrame(true);orbit.selectLayer(orbit.document.layers[2].id);orbit.document.cel.pixels.fill(0);}orbit.setFrameDuration(140);rows(orbit,moon,...poses[f]);}
 await asset('orbit-loop','Orbit loop','Four moon positions around a small planet. Try timing and onion skin.',orbit.document);
 const garden=new PixelEditor(createDocument(32,24,'Garden patch'));garden.renameLayer('Soil');rows(garden,['..gggggggggggggggggggggggggggg..','.gllllllllllllllllllllllllllllg.','gllllllllllllllllllllllllllllllg','gttttttttttttttttttttttttttttttg','.ttstttttstttttttstttttttsttttt.','..tttttttttttttttttttttttttttt..','....tttttttttttttttttttttttt....','......tttttttttttttttttttt......'],0,16);
 garden.addLayer();garden.renameLayer('Plants');rows(garden,['.....ppp.....','....pwwwp....','...pwwywwp...','....pwwwp....','.....ppp.....','......g......','...ll.g......','..llllg..ll..','...llgg.llll.','.....gg..ll..','......g......','......g......'],1,5);rows(garden,['.....lll.....','....lwwwl....','...lwwywwl...','....lwwwl....','.....lll.....','......g......','......g.ll...','..ll..gllll..','.llll.g.ll...','..ll.gg......','......g......','......g......'],17,5);
 await asset('garden-patch','Garden patch','A small two-layer flower bed on a rectangular canvas.',garden.document);
 // Nine more original editable studies, each with its own geometry and timing.
 for(const [id,name,w,h,kind,frames,duration]of [
 ['slime-hop','Slime hop',24,24,'slime',6,110],['candle-flicker','Candle flicker',16,32,'candle',4,180],['rain-window','Rain window',32,32,'rain',8,90],['coin-spin','Coin spin',16,16,'coin',6,100],['sea-waves','Sea waves',48,24,'waves',8,140],['tiny-house','Tiny house',32,32,'house',1,100],['sword-icon','Sword icon',24,32,'sword',1,100],['neon-grid','Neon grid',64,32,'grid',4,220],['walk-cycle','Walk cycle',32,32,'walk',4,160]]){
  const e=new PixelEditor(createDocument(w,h,name));e.renameLayer('Backdrop');
  if(['rain','waves','grid','house'].includes(kind)){e.fill(0,0,hexColor('#19253d'));e.commit();}
  e.addLayer();e.renameLayer(name);
  for(let f=0;f<frames;f++){if(f){e.addFrame(true);e.document.cel.pixels.fill(0);}e.setFrameDuration(duration);
   if(kind==='slime'){const lift=[0,2,5,6,3,0][f];e.shape('Ellipse',{x:5,y:12-lift},{x:19,y:22-lift},hexColor('#8bab60'),true);for(const x of [9,15])e.paint(x,16-lift,hexColor('#19253d'));}
   if(kind==='candle'){e.shape('Rectangle',{x:5,y:15},{x:10,y:29},hexColor('#fff0c7'),true);e.shape('Ellipse',{x:6-f%2,y:6+f%3},{x:9+f%2,y:15},hexColor('#ffc05c'),true);}
   if(kind==='rain')for(let n=0;n<18;n++){const x=(n*11)%32,y=(n*7+f*3)%32;e.shape('Line',{x,y},{x,y:Math.min(31,y+3)},hexColor('#7cb9c9'));}
   if(kind==='coin'){const half=[5,3,1,2,4,5][f];e.shape('Ellipse',{x:8-half,y:2},{x:8+half,y:13},hexColor('#ffc05c'),true);e.shape('Line',{x:8,y:4},{x:8,y:10},hexColor('#fff0c7'));}
   if(kind==='waves')for(let x=0;x<w;x++)for(let y=0;y<3;y++){const yy=12+y*4+Math.round(Math.sin((x+f*3)/5)*2);e.paint(x,yy,hexColor(['#7cb9c9','#344b70','#fff0c7'][y]));}
   if(kind==='house'){e.shape('Rectangle',{x:6,y:14},{x:25,y:29},hexColor('#9d7552'),true);for(let y=4;y<15;y++)e.shape('Line',{x:16-(y-4),y},{x:16+(y-4),y},hexColor('#a43f3b'));e.shape('Rectangle',{x:13,y:21},{x:18,y:29},hexColor('#19253d'),true);for(const x of [8,21])e.shape('Rectangle',{x,y:17},{x:x+3,y:20},hexColor('#ffc05c'),true);}
   if(kind==='sword'){e.shape('Line',{x:5,y:25},{x:19,y:5},hexColor('#7cb9c9'),false,{size:3,shape:'square'});e.shape('Line',{x:3,y:19},{x:13,y:26},hexColor('#ffc05c'));e.shape('Line',{x:3,y:29},{x:7,y:24},hexColor('#715144'),false,{size:3,shape:'square'});}
   if(kind==='grid'){for(let x=f;x<w;x+=8)e.shape('Line',{x,y:0},{x,y:h-1},hexColor('#d694b9'));for(let y=f;y<h;y+=8)e.shape('Line',{x:0,y},{x:w-1,y},hexColor('#7cb9c9'));}
   if(kind==='walk'){const shift=[-3,0,3,0][f];e.shape('Ellipse',{x:12,y:4},{x:19,y:11},hexColor('#ffc05c'),true);e.shape('Rectangle',{x:12,y:12},{x:19,y:21},hexColor('#7cb9c9'),true);e.shape('Line',{x:14,y:21},{x:11+shift,y:28},hexColor('#fff0c7'),false,{size:2,shape:'square'});e.shape('Line',{x:17,y:21},{x:20-shift,y:28},hexColor('#fff0c7'),false,{size:2,shape:'square'});}
   e.commit();
  }
  if(frames>1)e.setTag({name:'Loop',from:0,to:frames-1,mode:'loop'});
  await asset(id,name,({slime:'Six-frame squash and hop.',candle:'Tall canvas with a flickering flame.',rain:'Eight-frame rainfall on a separate layer.',coin:'Six widths for a spinning pickup.',waves:'Wide looping water tile.',house:'Static layered building study.',sword:'Thick-stroke inventory icon.',grid:'Wide animated neon pattern.',walk:'Four-frame original character exercise.'})[kind],e.document);
 }
 await writeFile(resolve('../glitchbong/src/app/tools/ezpix/editor/starter-catalog.json'),JSON.stringify(catalog,null,2)+'\n');console.log('Authored '+catalog.length+' starter projects and matching PNG previews.');
}finally{await browser.close();}
