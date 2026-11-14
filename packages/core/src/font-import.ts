export interface FontPart {bytes:ArrayBuffer;style:string;weight:string;unicodeRange?:string;}
export function googleFontFamily(link:string){
 const url=new URL(link.trim());if(url.protocol!=='https:'||url.hostname!=='fonts.google.com'||url.username||url.password||url.port)throw Error('Paste an https://fonts.google.com/specimen/Family+Name link.');
 const match=url.pathname.match(/^\/specimen\/([^/]+)\/?$/);if(!match)throw Error('Open a font specimen and copy its link.');const family=decodeURIComponent(match[1].replace(/\+/g,' '));if(!/^[\p{L}\p{N} ._-]{1,100}$/u.test(family))throw Error('Invalid font family.');return family;
}
export function parseFontCss(css:string){
 if(css.length>256*1024)throw Error('Font description is too large.');const faces=[];
 for(const block of css.matchAll(/@font-face\s*\{([^}]+)\}/g)){const body=block[1],source=body.match(/url\((?:['"])?(https:\/\/fonts\.gstatic\.com\/[^\s)'";]+)(?:['"])?\)/)?.[1];if(!source)continue;const url=new URL(source);if(url.hostname!=='fonts.gstatic.com'||url.username||url.password||url.port)throw Error('Invalid font download host.');faces.push({url:url.href,style:body.match(/font-style:\s*([^;]+)/)?.[1].trim()??'normal',weight:body.match(/font-weight:\s*([^;]+)/)?.[1].trim()??'400',unicodeRange:body.match(/unicode-range:\s*([^;]+)/)?.[1].trim()});}
 if(!faces.length||faces.length>160)throw Error('This font could not be loaded. Check the Google Fonts link.');return faces;
}
export async function downloadFont(link:string,fetcher:typeof fetch=fetch){
 const family=googleFontFamily(link),request=async(url:string,max:number)=>{const response=await fetcher(url,{redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});if(!response.ok||Number(response.headers.get('content-length'))>max)throw Error('Font download failed or exceeds its size limit.');const reader=response.body?.getReader();if(!reader)throw Error('Empty font download.');const chunks:Uint8Array[]=[];let size=0;while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>max){await reader.cancel();throw Error('Font download exceeds its size limit.');}chunks.push(chunk.value);}const out=new Uint8Array(size);let offset=0;for(const part of chunks){out.set(part,offset);offset+=part.length;}return out;};
 const css=new TextDecoder().decode(await request('https://fonts.googleapis.com/css2?family='+encodeURIComponent(family)+'&display=swap',256*1024)),descriptions=parseFontCss(css),parts:FontPart[]=[];let total=0;
 for(const face of descriptions){const data=await request(face.url,8*1024*1024);total+=data.byteLength;if(total>16*1024*1024)throw Error('Font family exceeds 16 MiB. Choose a smaller family.');const magic=[...data.slice(0,4)].map(n=>String.fromCharCode(n)).join('');if(!['wOF2','wOFF','OTTO','\x00\x01\x00\x00'].includes(magic))throw Error('The download is not a supported font file.');parts.push({bytes:data.buffer as ArrayBuffer,style:face.style,weight:face.weight,unicodeRange:face.unicodeRange});}
 return {family,parts,bytes:total,source:'https://fonts.google.com/specimen/'+encodeURIComponent(family)};
}
