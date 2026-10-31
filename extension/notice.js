const failure=/failed|unavailable|exceeds|unsupported|could not|cannot|can't|declined|denied|blocked|expired|invalid|timed out|no camera|camera is busy|not found|use a video|use a smaller|corrupt|malformed|refused|too large|not supported|requires|must be/i;
export function showNotice(element,text,error=false){element.dataset.level=error?'error':'info';element.textContent=text;}
export function watchNotice(element){
 const update=()=>{element.dataset.level=failure.test(element.textContent??'')?'error':'info';};
 const observer=new MutationObserver(update);observer.observe(element,{childList:true,characterData:true,subtree:true});update();return()=>observer.disconnect();
}
