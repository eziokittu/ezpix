import {mountAccount,preferenceStorage} from '../packages/core/dist/account-client.js';
import {mountFontLibrary} from '../packages/core/dist/synced-fonts.js';
import {mountPreferencePalettes} from '../packages/core/dist/preference-palettes.js';
/** Opening a studio refreshes previously connected preferences without opening sign-in UI. */
export async function startAccountSync(existingFonts,studio){
 const storage=await preferenceStorage();
 const host=document.createElement('div');host.hidden=true;document.body.append(host);
 const fonts=existingFonts??mountFontLibrary(host,storage,document.body);
 const palettes=studio?mountPreferencePalettes(document.querySelector('.ez-focus-settings'),{storage,use:colors=>{studio.setCustomPalette(colors);const select=document.querySelector('[data-focus-palette]');select.value='custom';select.dispatchEvent(new Event('input',{bubbles:true}));}}):undefined;
 const account=await storage.read('account-token')?mountAccount(host,{
  platform:'extension',storage,
  readExtra:async()=>({fonts:[...new Map([...(await storage.read('font-sources')??[]),...await fonts.sources()].map(font=>[font.family,font])).values()],palettes:await storage.read('palettes')??[]}),
  applyExtra:async prefs=>{if(prefs.palettes)await storage.write('palettes',prefs.palettes.value);if(prefs.fonts){await storage.write('font-sources',prefs.fonts.value);await fonts.importSources(prefs.fonts.value);}},
 }):undefined;
 window.addEventListener('pagehide',()=>{account?.dispose();palettes?.dispose();if(!existingFonts)fonts.dispose();host.remove();},{once:true});
}
