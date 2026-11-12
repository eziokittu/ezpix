import {createCompanion} from './server.mjs';
const first=await createCompanion({port:0,name:'EzPix QA one'}),second=await createCompanion({port:0,name:'EzPix QA two'});
const api=async(helper,path,body={})=>{const response=await fetch(`http://127.0.0.1:${helper.port}/${path}`,{method:'POST',headers:{Origin:'https://glitchbong.com','Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error('Companion request failed: '+path);return response.json();};
try{
 const a=await api(first,'start'),b=await api(second,'start');let found=false;
 for(let n=0;n<30;n++){const ap=await api(first,'poll',{token:a.token}),bp=await api(second,'poll',{token:b.token});if(ap.devices.some(d=>d.id===b.id)&&bp.devices.some(d=>d.id===a.id)){found=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}
 if(!found)throw Error('Local multicast discovery did not find both fixture peers. Check private-network firewall/mDNS access.');
 await api(first,'send',{token:a.token,id:b.id,kind:'offer',code:'EZPX1.integration-fixture'});const received=await api(second,'poll',{token:b.token});if(received.signals[0]?.from!==a.id)throw Error('Pairing signal did not arrive.');
 console.log(JSON.stringify({sameComputerMdnsDiscovery:true,pairingSignalOverTcp:true,physicalDeviceVerified:false,artworkTransferred:false}));
}finally{await first.close();await second.close();}
