import { copyFileSync } from 'node:fs';
copyFileSync('packages/core/src/converter.css','packages/core/dist/converter.css');
copyFileSync('packages/core/src/local-share.css','packages/core/dist/local-share.css');

copyFileSync('packages/core/src/creative.css','packages/core/dist/creative.css');

copyFileSync('packages/core/UNICODE-LICENSE.txt','packages/core/dist/UNICODE-LICENSE.txt');

copyFileSync('packages/core/src/photo-editing.css','packages/core/dist/photo-editing.css');
