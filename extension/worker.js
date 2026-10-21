import { createConversionProcessor } from '../packages/core/dist/worker.js';
const processConversion=createConversionProcessor();
self.onmessage=event=>{try{const result=processConversion(event.data);self.postMessage(result,[result.pixels.buffer]);}catch(error){self.postMessage({error:error.message??'Conversion failed.'});}};
