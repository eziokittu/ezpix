let sequence=0;
/** Move existing controls without replacing their handlers or current draft values. */
export function panelTabs(parent:HTMLElement,groups:{label:string;nodes:HTMLElement[]}[],changed?:(index:number)=>void){
 const id=`ez-panel-tabs-${++sequence}`,root=document.createElement('div');root.className='panel-tabs';
 const bar=document.createElement('div');bar.className='panel-tab-bar';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Tool sections');root.append(bar);
 const buttons:HTMLButtonElement[]=[],panels:HTMLElement[]=[];
 function select(index:number,focus=false){buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});if(focus)buttons[index].focus();changed?.(index);}
 groups.forEach((group,index)=>{const button=document.createElement('button');button.type='button';button.id=`${id}-tab-${index}`;button.textContent=group.label;button.setAttribute('role','tab');button.setAttribute('aria-controls',`${id}-panel-${index}`);button.onclick=()=>select(index);button.onkeydown=event=>{const next=event.key==='ArrowRight'?(index+1)%groups.length:event.key==='ArrowLeft'?(index+groups.length-1)%groups.length:event.key==='Home'?0:event.key==='End'?groups.length-1:-1;if(next>=0){event.preventDefault();select(next,true);}};buttons.push(button);bar.append(button);const panel=document.createElement('section');panel.id=`${id}-panel-${index}`;panel.className='panel-tab-body';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.append(...group.nodes);panels.push(panel);root.append(panel);});
 parent.prepend(root);select(0);return {select,root,panels};
}
