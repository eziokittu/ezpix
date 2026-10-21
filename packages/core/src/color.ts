import type {RGBA} from './document.js';
export function hexColor(hex: string): RGBA {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Choose a six-digit hex colour.");
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
export function rgbToHsv(r:number,g:number,b:number):{h:number;s:number;v:number} {
  if(![r,g,b].every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw new Error('RGB channels must be integers from 0 to 255.');
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return {h,s:max?d/max*100:0,v:max*100};
}
export function hsvToHex(h:number,s:number,v:number):string {
  if(![h,s,v].every(Number.isFinite)||h<0||h>360||s<0||s>100||v<0||v>100)throw new Error('HSV is outside its supported range.');
  h=(h%360)/60;s/=100;v/=100;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;
  const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
  return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
