/** Clockwise angles in screen coordinates. No interpolation or alpha conversion. */
export type QuarterTurn=0|90|180|270;
export function rotatedSize(width:number,height:number,rotation:QuarterTurn){
 if(![0,90,180,270].includes(rotation))throw new Error('Choose a quarter-turn rotation.');
 return rotation===90||rotation===270?{width:height,height:width}:{width,height};
}
/** Rotate, nearest-sample to output size, then flip along output axes. */
export function permuteRaster(pixels:Uint8ClampedArray|Uint8Array,width:number,height:number,outWidth:number,outHeight:number,rotation:QuarterTurn=0,flipX=false,flipY=false,channels=4){
 const size=rotatedSize(width,height,rotation),output=new Uint8ClampedArray(outWidth*outHeight*channels);
 for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){
  const rx=Math.floor((2*(flipX?outWidth-1-x:x)+1)*size.width/(2*outWidth)),ry=Math.floor((2*(flipY?outHeight-1-y:y)+1)*size.height/(2*outHeight));
  const sx=rotation===90?ry:rotation===180?width-1-rx:rotation===270?width-1-ry:rx;
  const sy=rotation===90?height-1-rx:rotation===180?height-1-ry:rotation===270?rx:ry,source=(sy*width+sx)*channels;
  output.set(pixels.subarray(source,source+channels),(y*outWidth+x)*channels);
 }
 return output;
}
