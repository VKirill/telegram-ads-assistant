import {readFile,stat} from 'node:fs/promises';
import {basename,extname} from 'node:path';
import {createHash} from 'node:crypto';
export async function loadMedia(path){
 const info=await stat(path);if(!info.isFile())throw Error('Media must be a regular file');
 const ext=extname(path).toLowerCase(),mime={'.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];
 if(!mime)throw Error('Only MP4, JPEG and PNG supported');
 const max=mime==='video/mp4'?20971520:5242880;if(info.size>max)throw Error('Media exceeds conservative cabinet size limit');
 const bytes=await readFile(path);
 if(bytes.length!==info.size)throw Error('File changed while reading');
 const signature=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.subarray(4,8).toString()==='ftyp';
 if(!signature)throw Error('Media signature does not match extension');
 return {name:basename(path),mime,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')};
}

export async function resolveMediaSource({path,url}){
 if((!!path)===(!!url))throw Error('Specify exactly one of path or url');
 let downloaded=null;
 if(url){const {downloadMedia}=await import('./download.js');downloaded=await downloadMedia(url);path=downloaded.path;}
 const asset=await loadMedia(path);
 return {asset,cache:downloaded?{sha256:downloaded.sha256,bytes:downloaded.bytes,downloadedAt:downloaded.downloadedAt}:null};
}
