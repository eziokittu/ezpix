import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const devOrigin=process.env.EZPIX_DEV_ORIGIN??'http://localhost:3791';if(new URL(devOrigin).hostname!=='localhost'||new URL(devOrigin).protocol!=='http:')throw new Error('Development origin must be HTTP localhost.');
for(const dev of [false,true]) {
  const out=resolve(dev?'dist/extension-dev':'dist/extension');await mkdir(out,{recursive:true});
  await build({entryPoints:['extension/background.js','extension/popup.js','extension/app.js','extension/worker.js'],outdir:out,bundle:true,format:'esm',platform:'browser',target:'chrome120',plugins:dev?[{name:'local-website',setup(b){b.onLoad({filter:/extension[\\/]config\.js$/},()=>({contents:`export const WEBSITE_ORIGIN=${JSON.stringify(devOrigin)};`,loader:'js'}));}}]:[]});
  for(const file of ['popup.html','app.html','app.css','handoff.html','privacy.html','pixel-studio.css'])await copyFile(`extension/${file}`,resolve(out,file));
  await mkdir(resolve(out,'icons'),{recursive:true});for(const size of [16,32,48,128])await copyFile(`extension/icons/snapforge-${size}.png`,resolve(out,`icons/snapforge-${size}.png`));
  await copyFile('packages/core/dist/converter.css',resolve(out,'converter.css'));
  const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
  if(dev){manifest.name+=' (Local development)';manifest.externally_connectable.matches=['http://localhost/*'];}
  await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log('Built production and localhost extension folders. No store publication performed.');
