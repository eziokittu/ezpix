import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {createCompanion,validateSignal,localAddress} from './server.mjs';

test('LAN addresses and bounded pairing messages reject public destinations and artwork',()=>{
 assert.equal(localAddress('8.8.8.8'),false);assert.equal(localAddress('172.32.1.1'),false);assert.equal(localAddress('192.168.1.2'),true);assert.equal(localAddress('::ffff:10.1.2.3'),true);
 const id=randomUUID(),message={v:1,to:id,from:randomUUID(),name:'Phone',kind:'offer',code:'EZPX1.fixture'};
 assert.equal(validateSignal(message,id).name,'Phone');assert.throws(()=>validateSignal({...message,code:'image bytes'},id));assert.throws(()=>validateSignal({...message,code:'EZPX1.'+'x'.repeat(60000)},id));assert.throws(()=>validateSignal(message,randomUUID()));
});
test('loopback API binds origin and session, delivers pairing signal and tears down LAN presence',async()=>{
 const helper=await createCompanion({port:0,advertise:false});const origin='https://glitchbong.com';
 const request=(path,body={},useOrigin=origin)=>fetch(`http://127.0.0.1:${helper.port}/${path}`,{method:'POST',headers:{Origin:useOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{assert.equal(helper.lanPort,undefined);assert.equal((await request('start',{},'https://evil.example')).status,403);const started=await (await request('start')).json();assert.ok(helper.lanPort);assert.equal((await request('poll',{token:'wrong'})).status,409);assert.equal((await request('start')).status,409);
  await new Promise((resolve,reject)=>{const socket=net.createConnection({port:helper.lanPort,host:'127.0.0.1'},()=>socket.write(JSON.stringify({v:1,to:started.id,from:randomUUID(),name:'Test phone',kind:'offer',code:'EZPX1.fixture'})+'\n'));socket.on('error',reject);socket.on('data',data=>{assert.equal(data.toString(),'OK\n');socket.end();resolve();});});
  const first=await (await request('poll',{token:started.token})).json();assert.equal(first.signals.length,1);assert.equal(first.signals[0].name,'Test phone');assert.equal((await (await request('poll',{token:started.token})).json()).signals.length,0);await request('stop',{token:started.token});assert.equal(helper.lanPort,undefined);assert.equal((await request('poll',{token:started.token})).status,409);
 }finally{await helper.close();}
});
