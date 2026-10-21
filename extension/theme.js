export function mountTheme(){
  const picker=document.querySelector('[data-theme-picker]');
  try{const theme=localStorage.getItem('ezpix.theme.v1');if(['system','dark','light'].includes(theme))picker.value=theme;}catch{}
  const update=()=>{document.body.dataset.theme=picker.value;try{localStorage.setItem('ezpix.theme.v1',picker.value);}catch{}};
  picker.onchange=update;update();
}
