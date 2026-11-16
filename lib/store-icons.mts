import {PKG_RE,APPLE_APP_ID_RE} from './apps.ts';

/** Prefer a square Play CDN size; og:image often ends with =s0-br30 (wide banner). */
export function normalizeStoreIconUrl(url:string){
 if(/play-lh\.googleusercontent\.com/i.test(url))return url.replace(/=s0-br\d+$/i,'=s128').replace(/=w\d+-h\d+.*$/i,'=s128').replace(/=s\d+$/i,'=s128');
 if(/mzstatic\.com/i.test(url))return url.replace(/\/\d+x\d+bb\./,'/128x128bb.');
 return url;
}

/** Public Play Store listing → og:image (Googleusercontent CDN). */
export async function fetchPlayStoreIconUrl(packageName:string,fetcher:typeof fetch=fetch){
 if(!PKG_RE.test(packageName))return null;
 const url=`https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en&gl=US`;
 try{
  const res=await fetcher(url,{
   headers:{
    'User-Agent':'Mozilla/5.0 (compatible; NolsoopDashboard/1.0; +https://dashboard.nolsoopgames.com)',
    'Accept-Language':'en-US,en;q=0.9',
   },
   signal:AbortSignal.timeout(12000),
   redirect:'follow',
  });
  if(!res.ok)return null;
  const html=await res.text();
  const og=html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
   ||html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if(og?.[1])return normalizeStoreIconUrl(og[1]);
  const item=html.match(/itemprop=["']image["']\s+content=["']([^"']+)["']/i);
  return item?.[1]?normalizeStoreIconUrl(item[1]):null;
 }catch{return null;}
}

/** iTunes Lookup (no ASC auth) → artworkUrl512. */
export async function fetchItunesIconUrl(appleAppId:string,fetcher:typeof fetch=fetch){
 if(!APPLE_APP_ID_RE.test(appleAppId))return null;
 try{
  const res=await fetcher(`https://itunes.apple.com/lookup?id=${encodeURIComponent(appleAppId)}`,{signal:AbortSignal.timeout(10000)});
  if(!res.ok)return null;
  const body=await res.json() as {results?:{artworkUrl512?:string;artworkUrl100?:string}[]};
  const row=body.results?.[0];
  const url=row?.artworkUrl512||row?.artworkUrl100||null;
  return url?normalizeStoreIconUrl(url):null;
 }catch{return null;}
}

export async function resolveStoreIconUrl(opts:{androidPkg?:string|null;appleAppId?:string|null},fetcher:typeof fetch=fetch){
 if(opts.androidPkg){
  const play=await fetchPlayStoreIconUrl(opts.androidPkg,fetcher);
  if(play)return {url:play,source:'play' as const};
 }
 if(opts.appleAppId){
  const itunes=await fetchItunesIconUrl(opts.appleAppId,fetcher);
  if(itunes)return {url:itunes,source:'itunes' as const};
 }
 return null;
}

export function extractOgImage(html:string){
 const og=html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
  ||html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
 return og?.[1]||null;
}
