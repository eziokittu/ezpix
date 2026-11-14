/** App-themed, asynchronous prompts. Cancellation never changes the caller's value. */
export function appDialog(message:string,initial?:string):Promise<string|null>{
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='ez-app-dialog'+(initial===undefined&&/delete|discard|close|exit|replace|reset|cancel|remove/i.test(message)?' destructive-dialog':'');if(/close ezpix|exit ezpix/i.test(message)){const logo=document.createElement('img');logo.className='dialog-brand';logo.src='./icons/ezpix-128.png';logo.alt='EzPix';dialog.append(logo);}dialog.setAttribute('aria-label',initial===undefined?'Confirm action':'Edit name');
  const title=document.createElement('p');title.textContent=message;dialog.append(title);
  let input:HTMLInputElement|undefined;
  if(initial!==undefined){input=document.createElement('input');input.type='text';input.value=initial;input.maxLength=120;input.setAttribute('aria-label',message);dialog.append(input);}
  const actions=document.createElement('div');actions.className='ez-dialog-actions';dialog.append(actions);
  let done=false;const finish=(value:string|null)=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};
  for(const [name,label,path]of [['cancel','Cancel','m6 6 12 12M6 18 18 6'],['accept','Confirm','m5 12 4 4L19 6']]){
   const button=document.createElement('button');button.type='button';button.dataset.dialogAction=name;button.setAttribute('aria-label',label);button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';const text=document.createElement('span');text.textContent=label;button.append(text);button.onclick=()=>finish(name==='accept'?(input?.value??'yes'):null);actions.append(button);
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();finish(input?.value??'yes');}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finish(null);});
  document.body.append(dialog);dialog.showModal();(input??actions.querySelector('button'))?.focus();input?.select();
 });
}
export const appPrompt=(message:string,initial='')=>appDialog(message,initial);
export const appConfirm=async(message:string)=>(await appDialog(message))!==null;
