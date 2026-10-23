/** Shared discoverable editor command IDs and portable Mod (Ctrl/Command) bindings. */
export const EDITOR_COMMANDS=[
 ...['references','text','effects','palette','slices'].map(id=>({id:`authored.${id}`,label:({references:'Reference placement and tracing',text:'Editable bitmap text layers',effects:'Adjustment layers and group effects',palette:'Palette groups and locks',slices:'Sprite slices and pivots'} as Record<string,string>)[id],group:'Authoring',binding:''})),
 {id:'asset-export',label:'APNG, asset bundles and export presets',group:'Export',binding:''},
 {id:'layer-studio',label:'Layer masks, live effects and cels',group:'Layer',binding:''},
 {id:'coverage',label:'Soft selection studio',group:'Selection',binding:''},{id:'studio.transform-tween',label:'Baked transform tween',group:'Studio',binding:''},
 ...["text", "iso", "motion", "mosaic", "posterize", "edges", "noise"].map(id=>({id:`studio.${id}`,label:({"text": "Bitmap text", "iso": "Isometric construction", "motion": "Motion blur", "mosaic": "Mosaic blocks", "posterize": "Posterization", "edges": "Edge filters", "noise": "Seeded noise"} as Record<string,string>)[id],group:'Studio',binding:''})),
 ...['polygon','curve','gradient','rotate','shear','perspective','offset','guides'].map(id=>({id:`canvas.${id}`,label:`Canvas ${id}`,group:'Canvas',binding:''})),
 {id:'split',label:'Split preview',group:'Canvas',binding:''},
 ...['Pencil','Eraser','Fill','Pick','Pan','Line','Rectangle','Ellipse','Select'].map((name,i)=>({id:`tool.${name}`,label:name,group:'Tools',binding:['b','e','f','i','h','l','r','o','m'][i]})),
 ...([['save','Save project','Mod+s'],['open','Open project','Mod+o'],['new','New sprite','Mod+n'],['undo','Undo','Mod+z'],['redo','Redo','Mod+Shift+z'],['swap','Swap inks','x'],['reset','Reset inks','d'],['smaller','Smaller brush','['],['larger','Larger brush',']'],['search','Command search','Mod+k'],['drawing','Advanced drawing',''],['onion','Onion settings','']] as const).map(([id,label,binding])=>({id,label,group:'Editor',binding})),
 ...['polygon','curve','gradient','rotate','shear','perspective','offset','outline','shadow','alpha','cels','timing','sequence'].map(id=>({id:`studio.${id}`,label:({polygon:'Polygon drawing',curve:'Bezier curves',gradient:'RGBA gradients',rotate:'Free rotation',shear:'Affine shear',perspective:'Perspective warp',offset:'Seamless offset',outline:'Contour outline',shadow:'Cast shadow',alpha:'Alpha morphology',cels:'Bulk cel editing',timing:'Animation retiming',sequence:'Animation sequencing'} as Record<string,string>)[id],group:'Studio',binding:''}))
] as const;
export type CommandBindings=Record<string,string>;
export const defaultCommandBindings=():CommandBindings=>Object.fromEntries(EDITOR_COMMANDS.map(c=>[c.id,c.binding]));
export function canonicalBinding(input:string):string{
 if(typeof input!=='string'||input.length>32)throw new Error('Shortcut is too long.');if(!input.trim())return '';
 const parts=input.trim().split('+').map(p=>p.trim()),key=parts.pop()!.toLowerCase();if(!/^[a-z0-9\[\]]$/.test(key)||parts.some(p=>!['Mod','Shift','Alt'].includes(p))||new Set(parts).size!==parts.length)throw new Error('Use Mod, Shift or Alt plus a letter, digit, [ or ].');
 if(parts.includes('Mod')&&['w','q','t','r','l','p'].includes(key))throw new Error('That shortcut is reserved for the browser.');
 if(!parts.length&&['0','1','2','3','4','5','6','7','8','9'].includes(key))throw new Error('Use a modifier with digits.');
 return [...['Mod','Shift','Alt'].filter(p=>parts.includes(p)),key].join('+');
}
export function validateCommandBindings(input:unknown):CommandBindings{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==EDITOR_COMMANDS.length)throw new Error('Shortcut settings must contain every known command.');const output:CommandBindings={},used=new Map<string,string>();
 for(const c of EDITOR_COMMANDS){if(!Object.hasOwn(input,c.id))throw new Error('Missing shortcut command.');const binding=canonicalBinding((input as CommandBindings)[c.id]);if(binding&&used.has(binding))throw new Error(`${c.label} conflicts with ${used.get(binding)} (${binding}).`);if(binding)used.set(binding,c.label);output[c.id]=binding;}return output;
}
/** Add newly introduced unbound commands while preserving validated device preferences. */
export function upgradeCommandBindings(input:unknown):CommandBindings{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(id=>!EDITOR_COMMANDS.some(c=>c.id===id)))throw new Error('Unknown shortcut settings.');if(EDITOR_COMMANDS.filter(c=>!c.id.startsWith('canvas.')&&!c.id.startsWith('authored.')&&c.id!=='asset-export'&&c.id!=='split'&&c.id!=='coverage'&&c.id!=='layer-studio'&&c.id!=='studio.transform-tween'&&!['studio.text', 'studio.iso', 'studio.motion', 'studio.mosaic', 'studio.posterize', 'studio.edges', 'studio.noise'].includes(c.id)).some(c=>!Object.hasOwn(input,c.id)))throw new Error('Shortcut settings must contain every known command from the previous version.');return validateCommandBindings({...defaultCommandBindings(),...input});
}
export function commandForKey(bindings:CommandBindings,event:{key:string;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey:boolean}):string|undefined{
 const binding=[...((event.ctrlKey||event.metaKey)?['Mod']:[]),...(event.shiftKey?['Shift']:[]),...(event.altKey?['Alt']:[]),event.key.toLowerCase()].join('+');return EDITOR_COMMANDS.find(c=>bindings[c.id]===binding)?.id;
}
export function searchCommands(query:string){const terms=query.toLowerCase().trim().slice(0,128).split(/\s+/);return EDITOR_COMMANDS.filter(c=>terms.every(t=>`${c.label} ${c.group} ${c.id}`.toLowerCase().includes(t)));}
