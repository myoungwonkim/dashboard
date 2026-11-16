import {PlayError,parseInstallCsv} from './play-core.mts';

function splitCsvLine(line:string){
 const cols:string[]=[];let cur='',inQuotes=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(inQuotes){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')inQuotes=false;else cur+=ch;}
  else if(ch==='"')inQuotes=true;else if(ch===','){cols.push(cur);cur='';}else cur+=ch;
 }
 cols.push(cur);return cols;
}

export type InstallDay={date:string;installs:number;uninstalls:number;upgrades:number};
export type RatingDay={date:string;ratingAvg:number;ratingCount:number|null};
export type DimRow={date:string;key:string;installs:number;ratingAvg:number|null;visitors:number|null;pageViews:number|null;conversions:number|null};
export type PerfDay={date:string;visitors:number;acquisitions:number;conversionRate:number|null};

/** Overview installs CSV with uninstall/upgrade columns when present. */
export function parseInstallOverviewCsv(text:string,packageName:string):InstallDay[]{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [];
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const dateIdx=header.findIndex(h=>/^date$/i.test(h));
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const installIdx=header.findIndex(h=>/daily device installs/i.test(h)||/^daily user installs$/i.test(h));
 const uninstallIdx=header.findIndex(h=>/daily device uninstalls/i.test(h)||/daily user uninstalls/i.test(h));
 const upgradeIdx=header.findIndex(h=>/daily device upgrades/i.test(h)||/daily user upgrades/i.test(h));
 if(dateIdx<0||installIdx<0){
  return parseInstallCsv(text,packageName).daily.map(d=>({date:d.date,installs:d.installs,uninstalls:0,upgrades:0}));
 }
 const out:InstallDay[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const rawDate=cols[dateIdx],installs=Number(cols[installIdx]||0);
  if(!rawDate||!Number.isFinite(installs))throw new PlayError('invalid_response');
  const date=rawDate.replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))throw new PlayError('invalid_response');
  const uninstalls=uninstallIdx>=0?Number(cols[uninstallIdx]||0):0;
  const upgrades=upgradeIdx>=0?Number(cols[upgradeIdx]||0):0;
  out.push({date,installs,uninstalls:Number.isFinite(uninstalls)?uninstalls:0,upgrades:Number.isFinite(upgrades)?upgrades:0});
 }
 out.sort((a,b)=>a.date.localeCompare(b.date));
 return out;
}

export function parseRatingsOverviewCsv(text:string,packageName:string):RatingDay[]{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [];
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const dateIdx=header.findIndex(h=>/^date$/i.test(h));
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const avgIdx=header.findIndex(h=>/daily average rating/i.test(h)||/^average rating$/i.test(h));
 const totalAvgIdx=header.findIndex(h=>/total average rating/i.test(h));
 const countIdx=header.findIndex(h=>/total raters|rating count|ratings/i.test(h)&&!/average/i.test(h));
 if(dateIdx<0||(avgIdx<0&&totalAvgIdx<0))throw new PlayError('invalid_response');
 const out:RatingDay[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const rawDate=cols[dateIdx];
  const avg=Number(cols[avgIdx>=0?avgIdx:totalAvgIdx]||0);
  if(!rawDate||!Number.isFinite(avg))throw new PlayError('invalid_response');
  const date=rawDate.replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))throw new PlayError('invalid_response');
  const ratingCount=countIdx>=0?Number(cols[countIdx]):null;
  out.push({date,ratingAvg:avg,ratingCount:ratingCount!=null&&Number.isFinite(ratingCount)?ratingCount:null});
 }
 out.sort((a,b)=>a.date.localeCompare(b.date));
 return out;
}

export function parseDimCsv(text:string,packageName:string,dimLabel:RegExp):DimRow[]{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [];
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const dateIdx=header.findIndex(h=>/^date$/i.test(h));
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const keyIdx=header.findIndex(h=>dimLabel.test(h));
 const installIdx=header.findIndex(h=>/daily device installs|daily user installs|installs/i.test(h)&&!/uninstall/i.test(h));
 const ratingIdx=header.findIndex(h=>/average rating/i.test(h));
 const visitorIdx=header.findIndex(h=>/store listing visitors|visitors/i.test(h));
 const pageIdx=header.findIndex(h=>/store listing acquisition|page views|product page views/i.test(h));
 const convIdx=header.findIndex(h=>/conversion/i.test(h));
 if(dateIdx<0||keyIdx<0)throw new PlayError('invalid_response');
 const out:DimRow[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const rawDate=cols[dateIdx],key=cols[keyIdx];
  if(!rawDate||!key)continue;
  const date=rawDate.replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))continue;
  const installs=installIdx>=0?Number(cols[installIdx]||0):0;
  const ratingAvg=ratingIdx>=0?Number(cols[ratingIdx]):null;
  const visitors=visitorIdx>=0?Number(cols[visitorIdx]||0):null;
  const pageViews=pageIdx>=0?Number(cols[pageIdx]||0):null;
  const conversions=convIdx>=0?Number(cols[convIdx]||0):null;
  out.push({
   date,key,
   installs:Number.isFinite(installs)?installs:0,
   ratingAvg:ratingAvg!=null&&Number.isFinite(ratingAvg)?ratingAvg:null,
   visitors:visitors!=null&&Number.isFinite(visitors)?visitors:null,
   pageViews:pageViews!=null&&Number.isFinite(pageViews)?pageViews:null,
   conversions:conversions!=null&&Number.isFinite(conversions)?conversions:null,
  });
 }
 return out;
}

export function parseStorePerfOverviewCsv(text:string,packageName:string):PerfDay[]{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [];
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const dateIdx=header.findIndex(h=>/^date$/i.test(h));
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const visitorIdx=header.findIndex(h=>/store listing visitors/i.test(h)||/^visitors$/i.test(h));
 const acqIdx=header.findIndex(h=>/store listing acquisitions|acquisitions/i.test(h));
 const convIdx=header.findIndex(h=>/store listing conversion rate|conversion rate/i.test(h));
 if(dateIdx<0||visitorIdx<0)throw new PlayError('invalid_response');
 const out:PerfDay[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const rawDate=cols[dateIdx];
  if(!rawDate)continue;
  const date=rawDate.replaceAll('-','').slice(0,8);
  if(!/^\d{8}$/.test(date))continue;
  const visitors=Number(cols[visitorIdx]||0);
  const acquisitions=acqIdx>=0?Number(cols[acqIdx]||0):0;
  let conversionRate=convIdx>=0?Number(cols[convIdx]):null;
  if(conversionRate!=null&&conversionRate>1)conversionRate=conversionRate/100;
  out.push({date,visitors:Number.isFinite(visitors)?visitors:0,acquisitions:Number.isFinite(acquisitions)?acquisitions:0,conversionRate:conversionRate!=null&&Number.isFinite(conversionRate)?conversionRate:null});
 }
 out.sort((a,b)=>a.date.localeCompare(b.date));
 return out;
}

/** Decode UTF-16LE Play reviews CSV when present. */
export function decodeMaybeUtf16(buf:ArrayBuffer){
 const bytes=new Uint8Array(buf);
 if(bytes.length>=2&&bytes[0]===0xFF&&bytes[1]===0xFE)return new TextDecoder('utf-16le').decode(bytes);
 if(bytes.length>=2&&bytes[0]===0xFE&&bytes[1]===0xFF)return new TextDecoder('utf-16be').decode(bytes);
 // Heuristic: many NUL bytes → utf-16le without BOM
 let nuls=0;for(let i=1;i<Math.min(bytes.length,200);i+=2)if(bytes[i]===0)nuls++;
 if(nuls>20)return new TextDecoder('utf-16le').decode(bytes);
 return new TextDecoder('utf-8').decode(bytes);
}

export function parseReviewsHistoryCsv(text:string,packageName:string){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<2)return [] as {date:string;rating:number;title:string;text:string;author:string;replied:boolean}[];
 const header=splitCsvLine(lines[0]).map(h=>h.trim());
 const pkgIdx=header.findIndex(h=>/package/i.test(h));
 const dateIdx=header.findIndex(h=>/review submit date|date/i.test(h));
 const ratingIdx=header.findIndex(h=>/star rating|rating/i.test(h));
 const titleIdx=header.findIndex(h=>/review title|title/i.test(h));
 const textIdx=header.findIndex(h=>/review text|text/i.test(h));
 const authorIdx=header.findIndex(h=>/author|reviewer/i.test(h));
 const replyIdx=header.findIndex(h=>/developer reply|review reply/i.test(h));
 if(dateIdx<0||ratingIdx<0)return [];
 const out:{date:string;rating:number;title:string;text:string;author:string;replied:boolean}[]=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const cols=splitCsvLine(line);
  if(pkgIdx>=0&&cols[pkgIdx]&&cols[pkgIdx]!==packageName)continue;
  const raw=cols[dateIdx]||'';
  const date=raw.replaceAll('-','').replaceAll('/','').slice(0,8);
  const rating=Number(cols[ratingIdx]||0);
  if(!/^\d{8}$/.test(date)||!Number.isFinite(rating))continue;
  out.push({
   date,rating,
   title:String(cols[titleIdx]||'').slice(0,200),
   text:String(cols[textIdx]||'').slice(0,500),
   author:String(cols[authorIdx]||''),
   replied:!!(replyIdx>=0&&cols[replyIdx]&&cols[replyIdx].trim()),
  });
 }
 return out.slice(0,200);
}

export function playStatsObjectName(kind:'installs'|'ratings',packageName:string,yearMonth:string,suffix:'overview'|'country'|'app_version'='overview'){
 return `stats/${kind}/${kind}_${packageName}_${yearMonth}_${suffix}.csv`;
}
export function playPerfObjectName(packageName:string,yearMonth:string,suffix:'overview'|'traffic_source'='overview'){
 return `stats/store_performance/store_performance_${packageName}_${yearMonth}_${suffix}.csv`;
}
export function playReviewsObjectName(packageName:string,yearMonth:string){
 return `reviews/reviews_${packageName}_${yearMonth}.csv`;
}

export function yearMonthsAround(now=new Date(),count=3){
 const out:string[]=[];
 const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
 for(let i=0;i<count;i++){
  const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0');
  out.push(`${y}${m}`);
  d.setUTCMonth(d.getUTCMonth()-1);
 }
 return out;
}

/** Inclusive YYYYMM list for a YYYYMMDD window, plus one prior month for export lag. */
export function yearMonthsForRange(startYmd:string,endYmd:string){
 if(!/^\d{8}$/.test(startYmd)||!/^\d{8}$/.test(endYmd))return yearMonthsAround();
 const start=new Date(Date.UTC(+startYmd.slice(0,4),+startYmd.slice(4,6)-1,1));
 start.setUTCMonth(start.getUTCMonth()-1);
 const end=new Date(Date.UTC(+endYmd.slice(0,4),+endYmd.slice(4,6)-1,1));
 const out:string[]=[];
 for(let d=new Date(end);d>=start;d.setUTCMonth(d.getUTCMonth()-1)){
  out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}`);
 }
 return out;
}

function isHardPlayError(error:unknown){
 return error instanceof PlayError&&(error.code==='permission_denied'||error.code==='authentication_failed');
}

/** Play Console GCS reports are often gzip + UTF-16LE; never decode as plain UTF-8 text. */
export async function decodePlayCsvBytes(buf:ArrayBuffer){
 let bytes=new Uint8Array(buf);
 if(bytes.length>=2&&bytes[0]===0x1f&&bytes[1]===0x8b){
  const stream=new Response(buf).body?.pipeThrough(new DecompressionStream('gzip'));
  if(!stream)throw new PlayError('invalid_response');
  buf=await new Response(stream).arrayBuffer();
  bytes=new Uint8Array(buf);
 }
 return decodeMaybeUtf16(buf);
}

export async function gcsDownloadBytes(bucket:string,objectName:string,token:string,fetcher:typeof fetch=fetch){
 const url=`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
 const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(45000)});
 if(res.status===404)return null;
 if(!res.ok)throw new PlayError(res.status===403?'permission_denied':res.status===401?'authentication_failed':'provider_error',res.status===429?429:502);
 return await res.arrayBuffer();
}

export async function gcsDownload(bucket:string,objectName:string,token:string,fetcher:typeof fetch=fetch){
 const bytes=await gcsDownloadBytes(bucket,objectName,token,fetcher);
 if(!bytes)return null;
 return decodePlayCsvBytes(bytes);
}

/** Live-read install overview CSVs for a date window without waiting for D1 batch. */
export async function fetchPlayInstallsLive(bucket:string,packageName:string,token:string,startYmd:string,endYmd:string,fetcher:typeof fetch=fetch){
 const installs:InstallDay[]=[];const seen=new Set<string>();
 for(const ym of yearMonthsForRange(startYmd,endYmd)){
  try{
   const text=await gcsDownload(bucket,playStatsObjectName('installs',packageName,ym),token,fetcher);
   if(!text)continue;
   for(const row of parseInstallOverviewCsv(text,packageName)){
    if(row.date<startYmd||row.date>endYmd||seen.has(row.date))continue;
    seen.add(row.date);installs.push(row);
   }
  }catch(error){
   if(isHardPlayError(error))throw error;
   // Missing/corrupt month files soft-fail; auth errors surface.
  }
 }
 installs.sort((a,b)=>a.date.localeCompare(b.date));
 const total=installs.reduce((s,r)=>s+r.installs,0);
 const uninstalls=installs.reduce((s,r)=>s+r.uninstalls,0);
 return {daily:installs,installs:total,uninstalls};
}

export async function fetchPlayCsvMetrics(bucket:string,packageName:string,token:string,fetcher:typeof fetch=fetch){
 const installs:InstallDay[]=[];const ratings:RatingDay[]=[];
 const countries:DimRow[]=[];const versions:DimRow[]=[];const traffic:DimRow[]=[];
 const perf:PerfDay[]=[];const reviewHistory:{date:string;rating:number;title:string;text:string;author:string;replied:boolean}[]=[];
 const seenInstall=new Set<string>(),seenRating=new Set<string>(),seenPerf=new Set<string>();
 const tryText=async(objectName:string)=>{
  try{return await gcsDownload(bucket,objectName,token,fetcher);}
  catch(error){if(isHardPlayError(error))throw error;return null;}
 };
 for(const ym of yearMonthsAround(new Date(),4)){
  const installText=await tryText(playStatsObjectName('installs',packageName,ym));
  if(installText){for(const row of parseInstallOverviewCsv(installText,packageName)){if(!seenInstall.has(row.date)){seenInstall.add(row.date);installs.push(row);}}}
  const ratingText=await tryText(playStatsObjectName('ratings',packageName,ym));
  if(ratingText){for(const row of parseRatingsOverviewCsv(ratingText,packageName)){if(!seenRating.has(row.date)){seenRating.add(row.date);ratings.push(row);}}}
  const countryText=await tryText(playStatsObjectName('installs',packageName,ym,'country'));
  if(countryText){try{countries.push(...parseDimCsv(countryText,packageName,/country/i));}catch{/* skip */}}
  const versionText=await tryText(playStatsObjectName('installs',packageName,ym,'app_version'));
  if(versionText){try{versions.push(...parseDimCsv(versionText,packageName,/app version/i));}catch{/* skip */}}
  const perfText=await tryText(playPerfObjectName(packageName,ym));
  if(perfText){try{for(const row of parseStorePerfOverviewCsv(perfText,packageName)){if(!seenPerf.has(row.date)){seenPerf.add(row.date);perf.push(row);}}}catch{/* skip */}}
  const trafficText=await tryText(playPerfObjectName(packageName,ym,'traffic_source'));
  if(trafficText){try{traffic.push(...parseDimCsv(trafficText,packageName,/traffic source/i));}catch{/* skip */}}
  try{
   const bytes=await gcsDownloadBytes(bucket,playReviewsObjectName(packageName,ym),token,fetcher);
   if(bytes)reviewHistory.push(...parseReviewsHistoryCsv(await decodePlayCsvBytes(bytes),packageName));
  }catch(error){if(isHardPlayError(error))throw error;}
 }
 installs.sort((a,b)=>a.date.localeCompare(b.date));
 ratings.sort((a,b)=>a.date.localeCompare(b.date));
 perf.sort((a,b)=>a.date.localeCompare(b.date));
 return {installs,ratings,countries,versions,traffic,perf,reviewHistory};
}
