/** One Google Form for every product and intent. Fill these once the owner supplies the form. */
export const FEEDBACK_FORM = {url:'',typeEntry:'',appEntry:''};
export const FEEDBACK_TYPES = [
  {id:'issue',label:'Report an issue'},
  {id:'feedback',label:'Give feedback'},
  {id:'feature',label:'Request a feature'},
] as const;
export type FeedbackType = typeof FEEDBACK_TYPES[number]['id'];
export type FeedbackApp = 'EzPix Android'|'EzPIX Insta'|'EzPix website';
export function feedbackUrl(type:FeedbackType,app:FeedbackApp,config=FEEDBACK_FORM):string|null {
  if(!config.url.trim())return null;
  const url=new URL(config.url);
  if(url.protocol!=='https:'||url.username||url.password||!(url.hostname==='forms.gle'||url.hostname==='docs.google.com'&&url.pathname.startsWith('/forms/')))throw Error('Feedback must link to an HTTPS Google Form.');
  const label=FEEDBACK_TYPES.find(entry=>entry.id===type)?.label;
  if(!label)throw Error('Unknown feedback category.');
  // These are optional Google Forms prefill field IDs; no artwork or device identifiers are attached.
  if(/^entry\.\d+$/.test(config.typeEntry))url.searchParams.set(config.typeEntry,label);
  if(/^entry\.\d+$/.test(config.appEntry))url.searchParams.set(config.appEntry,app);
  return url.href;
}
export function mountFeedbackButtons(host:HTMLElement,app:FeedbackApp){
  const section=document.createElement('section');section.className='ez-feedback';section.setAttribute('aria-label','Help improve EzPix');
  const status=document.createElement('p');status.setAttribute('role','status');
  for(const entry of FEEDBACK_TYPES){const button=document.createElement('button');button.type='button';button.dataset.feedback=entry.id;button.textContent=entry.label;button.onclick=()=>{try{const url=feedbackUrl(entry.id,app);if(url)window.open(url,'_blank','noopener,noreferrer');else status.textContent='The feedback form is coming soon. Please check back after the next update.';}catch{status.textContent='The feedback form is temporarily unavailable.';}};section.append(button);}
  section.append(status);host.append(section);return ()=>section.remove();
}
