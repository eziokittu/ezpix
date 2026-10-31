// Original vector layouts, rendered locally at their exact Chrome listing sizes.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';

export async function generateStoreGraphics(){
 const out='dist/store-assets';await mkdir(out,{recursive:true});
 const icon=(await readFile('extension/icons/ezpix-insta.svg','utf8')).replace(/<svg[^>]*>|<\/svg>/g,'');
 const defs=`<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#102e58"/><stop offset="1" stop-color="#061125"/></linearGradient><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#9cddff" stroke-opacity=".055"/></pattern></defs>`;
 const logo=(x,y,size)=>`<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="20 20 87 87">${icon}</svg>`;
 const pixels=(x,y,scale,color)=>`<path transform="translate(${x} ${y}) scale(${scale})" d="M2 0H4V2H6V4H4V6H2V4H0V2H2Z" fill="${color}"/>`;
 const wrap=(width,height,content)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}<rect width="${width}" height="${height}" fill="url(#bg)"/><rect width="${width}" height="${height}" fill="url(#grid)"/>${content}</svg>`;
 const tiles=[
  {name:'ezpix-insta-small-promo-440x280',width:440,height:280,svg:wrap(440,280,`
   <circle cx="220" cy="103" r="106" fill="#36d5f2" opacity=".06"/>
   ${pixels(54,67,4,'#36d5f2')}${pixels(354,115,3,'#5792ff')}
   <path d="M76 166H88V178H76ZM350 58H358V66H350ZM333 193H341V201H333Z" fill="#36d5f2" opacity=".4"/>
   ${logo(119,-2,202)}
   <text x="220" y="226" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#eff8ff">EzPIX <tspan fill="#36d5f2">Insta</tspan></text>
   <text x="220" y="252" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" fill="#adcff0">CAPTURE &amp; CONVERT</text>`)},
  {name:'ezpix-insta-marquee-1400x560',width:1400,height:560,svg:wrap(1400,560,`
   <circle cx="1063" cy="280" r="224" fill="#36d5f2" opacity=".055"/>
   <path d="M0 514H266V500H322V486H378V472H434V560H0Z" fill="#36d5f2" opacity=".045"/>
   <text x="88" y="174" font-family="Arial,sans-serif" font-size="17" letter-spacing="4" fill="#8db9e6">BY GLITCHBONG</text>
   <text x="84" y="260" font-family="Arial,sans-serif" font-size="74" font-weight="700" letter-spacing="-2" fill="#eff8ff">EzPIX <tspan fill="#36d5f2">Insta</tspan></text>
   <text x="88" y="320" font-family="Arial,sans-serif" font-size="32" fill="#d9efff">Instant pixel art. In Chrome.</text>
   <path d="M88 365H126V369H88Z" fill="#5792ff"/>
   <text x="88" y="408" font-family="Arial,sans-serif" font-size="18" letter-spacing="3" fill="#adcff0">CAPTURE &#183; CONVERT &#183; CREATE</text>
   ${pixels(780,81,5,'#36d5f2')}${pixels(1230,391,6,'#5792ff')}
   <path d="M1274 126H1286V138H1274ZM780 421H790V431H780Z" fill="#72a9ff"/>
   ${logo(825,47,454)}
   <path d="M1312 270H1328V286H1312ZM1296 286H1312V302H1296ZM1312 302H1328V318H1312Z" fill="#36d5f2" opacity=".4"/>`)}
 ];
 const browser=await chromium.launch({executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true});
 try{
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const tile of tiles){
   await writeFile(`${out}/${tile.name}.svg`,tile.svg);
   await page.setViewportSize({width:tile.width,height:tile.height});
   await page.setContent('<style>html,body{margin:0}svg{display:block}</style>'+tile.svg);
   await page.screenshot({path:`${out}/${tile.name}.png`,omitBackground:false});
  }
 }finally{await browser.close();}
 console.log('Rendered centered-brand small and marquee promo tiles. Original vectors; no remote artwork.');
}
