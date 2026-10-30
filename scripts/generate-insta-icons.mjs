// Original vector mark, rendered locally; no font/dependency/remote artwork.
import {chromium} from 'playwright';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
const svg=await readFile('extension/icons/ezpix-insta.svg','utf8');
const browser=await chromium.launch({executablePath:process.env.EZPIX_CHROMIUM_PATH,headless:true});
try{const page=await browser.newPage({viewport:{width:128,height:128},deviceScaleFactor:1});
 // Keep the store icon's transparent border; fill toolbar sizes with the badge.
 for(const size of [16,32,48,128]){const artwork=svg.replace('width="128" height="128"',`width="${size}" height="${size}"`);await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>'+artwork);await page.locator('svg').screenshot({path:`extension/icons/ezpix-insta-${size}.png`,omitBackground:true});}
 await mkdir('dist/store-assets',{recursive:true});await copyFile('extension/icons/ezpix-insta-128.png','dist/store-assets/ezpix-insta-icon-128.png');
}finally{await browser.close();}
