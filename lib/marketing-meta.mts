/** Meta Marketing API — daily spend for an ad account. */

export type MetaAdsCreds={
 access_token:string;
 ad_account_id:string; // with or without act_
};

export function normalizeAdAccountId(raw:string){
 const v=String(raw||'').trim();
 if(!v)return '';
 return v.startsWith('act_')?v:`act_${v.replace(/\D/g,'')}`;
}

export function validateMetaAdsCreds(raw:unknown):MetaAdsCreds{
 const o=raw as Record<string,unknown>;
 if(!o||typeof o!=='object')throw Error('invalid_meta');
 const access_token=String(o.access_token||'').trim();
 const ad_account_id=normalizeAdAccountId(String(o.ad_account_id||''));
 if(!access_token||!ad_account_id.startsWith('act_'))throw Error('invalid_meta');
 return {access_token,ad_account_id};
}

export async function fetchMetaDailySpend(c:MetaAdsCreds,startDate:string,endDate:string):Promise<{date:string;spend:number;currency?:string}[]>{
 const params=new URLSearchParams({
  fields:'spend,account_currency',
  time_increment:'1',
  time_range:JSON.stringify({since:startDate,until:endDate}),
  level:'account',
  limit:'500',
  access_token:c.access_token,
 });
 const url=`https://graph.facebook.com/v21.0/${c.ad_account_id}/insights?${params}`;
 const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!res.ok){
  if(res.status===401||res.status===403)throw Error('meta_permission');
  throw Error(`meta_http_${res.status}`);
 }
 const body=await res.json() as {data?:{date_start?:string;spend?:string;account_currency?:string}[];error?:{message?:string}};
 if(body.error)throw Error('meta_api_error');
 const out:{date:string;spend:number;currency?:string}[]=[];
 for(const row of body.data||[]){
  const date=row.date_start;
  const spend=Number(row.spend||0);
  if(!date||!Number.isFinite(spend))continue;
  out.push({date,spend,currency:row.account_currency});
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
