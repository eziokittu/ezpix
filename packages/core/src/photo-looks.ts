/** Original EzPix colour grades. Parameters are authored here, never sampled from proprietary LUTs. */
export const PHOTO_LOOKS = [
  {id:'original',name:'Original',note:'True to your source',s:1,c:1,lift:0,warm:0,tint:0,split:0,grain:0,edge:0},
  {id:'chai',name:'Chai light',note:'Honey highlights, gently faded shadows',s:.9,c:.94,lift:7,warm:13,tint:1,split:3,grain:1,edge:.05},
  {id:'blue-hour',name:'Blue hour',note:'Cool dusk with a soft rose balance',s:.85,c:1.05,lift:2,warm:-12,tint:6,split:-4,grain:0,edge:.08},
  {id:'marigold',name:'Marigold',note:'Sunlit warmth and lively colour',s:1.16,c:1.04,lift:2,warm:17,tint:-2,split:4,grain:0,edge:.03},
  {id:'rosewater',name:'Rosewater',note:'Airy pinks and quiet contrast',s:.82,c:.88,lift:12,warm:3,tint:11,split:2,grain:0,edge:0},
  {id:'monsoon',name:'Monsoon',note:'Muted greens and cool, deep shadows',s:.72,c:1.09,lift:1,warm:-7,tint:-4,split:-7,grain:1,edge:.1},
  {id:'terracotta',name:'Terracotta',note:'Earthy reds and a soft print finish',s:.8,c:1.03,lift:5,warm:15,tint:4,split:6,grain:2,edge:.06},
  {id:'sea-glass',name:'Sea glass',note:'Pale aqua shadows, clean highlights',s:.84,c:.95,lift:8,warm:-8,tint:-7,split:-5,grain:0,edge:0},
  {id:'festival',name:'Festival',note:'Bright colour with grounded blacks',s:1.32,c:1.12,lift:-3,warm:3,tint:2,split:2,grain:0,edge:.04},
  {id:'paper-matte',name:'Paper matte',note:'Faded ink on warm paper',s:.68,c:.81,lift:18,warm:6,tint:1,split:2,grain:2,edge:.03},
  {id:'silver-street',name:'Silver street',note:'Crisp monochrome with a cool finish',s:0,c:1.23,lift:-4,warm:-2,tint:0,split:-1,grain:2,edge:.1},
  {id:'cocoa',name:'Cocoa print',note:'Warm monochrome with lifted blacks',s:0,c:.96,lift:8,warm:12,tint:2,split:3,grain:2,edge:.08},
  {id:'neon-rain',name:'Neon rain',note:'Teal shadows and magenta highlights',s:1.13,c:1.16,lift:-3,warm:-6,tint:7,split:-12,grain:1,edge:.12},
  {id:'peach-dawn',name:'Peach dawn',note:'Soft apricot light and low contrast',s:.9,c:.9,lift:10,warm:10,tint:6,split:5,grain:0,edge:.02},
  {id:'pine-trail',name:'Pine trail',note:'Calm greens and a woodland finish',s:.88,c:1.07,lift:1,warm:-3,tint:-8,split:-3,grain:1,edge:.07},
] as const;
export type PhotoLookId = typeof PHOTO_LOOKS[number]['id'];
export const isPhotoLook = (value: unknown): value is PhotoLookId => PHOTO_LOOKS.some(look=>look.id===value);

/** Shared by worker processing and captured stills; deterministic grain, unchanged alpha. */
export function gradePixel(rgb:number[],look:typeof PHOTO_LOOKS[number],x:number,y:number,w:number,h:number):number[] {
  const grey=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,light=Math.max(0,Math.min(1,grey/255));
  const grain=(((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%997/996-.5)*look.grain*2;
  const edge=1-look.edge*Math.min(1,((x+.5)/w-.5)**2*2+((y+.5)/h-.5)**2*2);
  return rgb.map((v,k)=>((grey+(v-grey)*look.s-127.5)*look.c+127.5+look.lift
    +(k===0?look.warm:k===2?-look.warm:0)+(k===1?-look.tint:look.tint*.5)
    +(k===0?1:k===2?-1:0)*look.split*(light-.5)*2+grain)*edge);
}
