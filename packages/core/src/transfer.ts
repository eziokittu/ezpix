import { decodeProject, ENGINE_VERSION, type PixelDocument } from './index.js';
export const TRANSFER_LIMIT = 16 * 1024 * 1024;
export const CHUNK_BYTES = 128 * 1024;
export type BridgeSend = (message: Record<string, unknown>) => Promise<Record<string, unknown>>;
export async function receiveProject(send: BridgeSend): Promise<{ document: PixelDocument; acknowledge: () => Promise<void> }> {
  const manifest = await send({ op: 'manifest' });
  const size = manifest.size as number, count = manifest.count as number;
  if (manifest.protocol !== 1 || manifest.engine !== ENGINE_VERSION || !Number.isInteger(size) || size < 1 || size > TRANSFER_LIMIT || count !== Math.ceil(size / CHUNK_BYTES) || typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid or incompatible transfer. Download the project from the extension instead.');
  const bytes = new Uint8Array(size);
  for (let index = 0; index < count; index++) {
    const response = await send({ op:'chunk',index });
    if (typeof response.data !== 'string' || response.data.length > Math.ceil(CHUNK_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(response.data)) throw new Error('Invalid transfer chunk.');
    const raw = atob(response.data), expected = Math.min(CHUNK_BYTES,size-index*CHUNK_BYTES);
    if (raw.length !== expected || response.index !== index) throw new Error('Incomplete transfer chunk.');
    for (let i=0;i<raw.length;i++) bytes[index*CHUNK_BYTES+i] = raw.charCodeAt(i);
  }
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if (digest !== manifest.sha256) throw new Error('Transfer checksum mismatch. Retry or use the project file.');
  const document = decodeProject(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  return { document, acknowledge: async () => { const ack=await send({op:'ack',sha256:digest}); if (ack.status !== 'imported') throw new Error('Artwork imported, but acknowledgment failed. Retry acknowledgment.'); } };
}
