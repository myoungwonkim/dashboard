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
  // Fallback to simpler parser shape.
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

export function playStatsObjectName(kind:'installs'|'ratings',packageName:string,yearMonth:string){
 // Play Console export: stats/installs/installs_<pkg>_<YYYYMM>_overview.csv
 return `stats/${kind}/${kind}_${packageName}_${yearMonth}_overview.csv`;
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

export async function gcsDownload(bucket:string,objectName:string,token:string,fetcher:typeof fetch=fetch){
 const url=`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
 const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
 if(res.status===404)return null;
 if(!res.ok)throw new PlayError(res.status===403?'permission_denied':res.status===401?'authentication_failed':'provider_error',res.status===429?429:502);
 return await res.text();
}

export async function fetchPlayCsvMetrics(bucket:string,packageName:string,token:string,fetcher:typeof fetch=fetch){
 const installs:InstallDay[]=[];const ratings:RatingDay[]=[];
 const seenInstall=new Set<string>(),seenRating=new Set<string>();
 for(const ym of yearMonthsAround()){
  const installObj=playStatsObjectName('installs',packageName,ym);
  const ratingObj=playStatsObjectName('ratings',packageName,ym);
  try{
   const text=await gcsDownload(bucket,installObj,token,fetcher);
   if(text){for(const row of parseInstallOverviewCsv(text,packageName)){if(!seenInstall.has(row.date)){seenInstall.add(row.date);installs.push(row);}}}
  }catch(e){if(!(e instanceof PlayError&&e.code==='permission_denied')){/* soft skip missing months */}}
  try{
   const text=await gcsDownload(bucket,ratingObj,token,fetcher);
   if(text){for(const row of parseRatingsOverviewCsv(text,packageName)){if(!seenRating.has(row.date)){seenRating.add(row.date);ratings.push(row);}}}
  }catch{/* soft skip */}
 }
 installs.sort((a,b)=>a.date.localeCompare(b.date));
 ratings.sort((a,b)=>a.date.localeCompare(b.date));
 return {installs,ratings};
}
