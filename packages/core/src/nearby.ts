export interface NearbyDevice {id:string;name:string;}
export interface NearbySignal {from:string;name:string;kind:'offer'|'answer';code:string;}
export interface NearbyAdapter {
 start():Promise<{id:string;name:string}>;
 poll():Promise<{devices:NearbyDevice[];signals:NearbySignal[]}>;
 send(id:string,kind:'offer'|'answer',code:string):Promise<void>;
 stop():Promise<void>;
}

/** Optional first-party desktop companion. It carries pairing codes, never artwork. */
export function desktopNearby():NearbyAdapter {
 let token='';
 const request=async(path:string,body:unknown)=>{const response=await fetch('http://127.0.0.1:45822/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...body as object}),signal:AbortSignal.timeout(4000),cache:'no-store'});if(!response.ok)throw Error('Nearby companion unavailable. Start EzPix Nearby on this computer, or use QR pairing.');return response.json();};
 return {async start(){const result=await request('start',{});token=result.token;return result;},poll(){return request('poll',{});},async send(id,kind,code){await request('send',{id,kind,code});},async stop(){if(token)await request('stop',{});token='';}};
}
