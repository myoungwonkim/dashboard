export const MARKETING_SOURCES=['google_ads','meta','manual','other'] as const;
export type MarketingSource=typeof MARKETING_SOURCES[number];
export type MarketingDay={date:string;spend:number;currency:string;note?:string|null;source:MarketingSource;appId:string};

export function isMarketingSource(v:string):v is MarketingSource{
 return (MARKETING_SOURCES as readonly string[]).includes(v);
}

/** Parse CSV: date,app_id,source,spend[,currency[,note]] */
export function parseMarketingCsv(text:string):{rows:MarketingDay[];errors:string[]}{
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const rows:MarketingDay[]=[];const errors:string[]=[];
 if(!lines.length)return {rows,errors:['CSV가 비어 있습니다.']};
 let start=0;
 const header=lines[0].toLowerCase();
 if(header.includes('date')&&header.includes('spend'))start=1;
 for(let i=start;i<lines.length;i++){
  const cols=splitCsvLine(lines[i]);
  if(cols.length<4){errors.push(`${i+1}행: 열 부족 (date,app_id,source,spend)`);continue;}
  const [date,appId,sourceRaw,spendRaw,currency='USD',note]=cols;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){errors.push(`${i+1}행: 날짜 형식 YYYY-MM-DD`);continue;}
  if(!appId){errors.push(`${i+1}행: app_id 필요`);continue;}
  const source=sourceRaw.trim().toLowerCase().replace(/\s+/g,'_');
  const mapped=source==='google'||source==='googleads'?'google_ads':source==='facebook'||source==='fb'?'meta':source;
  if(!isMarketingSource(mapped)){errors.push(`${i+1}행: source는 google_ads|meta|manual|other`);continue;}
  const spend=Number(String(spendRaw).replace(/[,$]/g,''));
  if(!Number.isFinite(spend)||spend<0){errors.push(`${i+1}행: spend 숫자 오류`);continue;}
  rows.push({date,appId:appId.trim(),source:mapped,spend,currency:(currency||'USD').trim().toUpperCase()||'USD',note:note?.trim()||null});
 }
 return {rows,errors};
}

function splitCsvLine(line:string){
 const out:string[]=[];let cur='';let q=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}
  if(c===','&&!q){out.push(cur.trim());cur='';continue;}
  cur+=c;
 }
 out.push(cur.trim());
 return out;
}

export function rollupMarketing(rows:MarketingDay[]){
 const bySource:Record<string,number>={};
 const byDate:Record<string,number>={};
 let spend=0;
 for(const r of rows){
  spend+=r.spend;
  bySource[r.source]=(bySource[r.source]||0)+r.spend;
  byDate[r.date]=(byDate[r.date]||0)+r.spend;
 }
 const daily=Object.keys(byDate).sort().map(date=>({date,spend:byDate[date]}));
 return {spend,bySource,daily};
}

export function roas(revenue:number|null|undefined,spend:number|null|undefined){
 if(revenue==null||spend==null||!(spend>0))return null;
 return revenue/spend;
}

/** CPI / eCPI = 마케팅 비용 ÷ 신규(또는 설치). 분모가 0이면 null. */
export function cpi(spend:number|null|undefined,acquisitions:number|null|undefined){
 if(spend==null||acquisitions==null||!(acquisitions>0)||!Number.isFinite(spend))return null;
 return spend/acquisitions;
}

export function fmtSpend(v:number|null|undefined,currency='USD'){
 if(v==null||!Number.isFinite(v))return '—';
 if(currency==='USD')return '$'+v.toFixed(2);
 return `${v.toFixed(2)} ${currency}`;
}
