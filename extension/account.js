import {mountAccount,preferenceStorage} from '../packages/core/dist/account-client.js';
import {mountFontLibrary} from '../packages/core/dist/synced-fonts.js';
const storage=await preferenceStorage(),fonts=mountFontLibrary(document.querySelector('[data-font-host]'),storage,document.body);
const theme=()=>{document.body.dataset.theme=localStorage.getItem('ezpix.theme.v1')||'system';};theme();window.addEventListener('storage',theme);window.addEventListener('ezpix-theme',theme);
const account=mountAccount(document.querySelector('[data-account-host]'),{
 platform:'extension',storage,
 authorize:async()=>{const allowed=await chrome.permissions.request({origins:['https://glitchbong.com/*']});if(!allowed)throw Error('Account connection permission was declined. Local editing is unchanged.');},
 open:url=>chrome.tabs.create({url}),
 readExtra:async()=>({fonts:[...new Map([...(await storage.read('font-sources')??[]),...await fonts.sources()].map(font=>[font.family,font])).values()],palettes:await storage.read('palettes')??[]}),
 applyExtra:async prefs=>{if(prefs.palettes)await storage.write('palettes',prefs.palettes.value);if(prefs.fonts){await storage.write('font-sources',prefs.fonts.value);await fonts.importSources(prefs.fonts.value);}},
});
window.addEventListener('pagehide',()=>{account.dispose();fonts.dispose();},{once:true});
