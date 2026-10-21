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
 await writeFile(resolve('../glitchbong/src/app/tools/ezpix/editor/starter-catalog.json'),JSON.stringify(catalog,null,2)+'\n');console.log('Authored '+catalog.length+' starter projects and matching PNG previews.');
}finally{await browser.close();}
