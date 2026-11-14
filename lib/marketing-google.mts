/** Google Ads API — cost by day for one customer. */

export type GoogleAdsCreds={
 client_id:string;
 client_secret:string;
 refresh_token:string;
 developer_token:string;
 customer_id:string; // digits only
 login_customer_id?:string;
};

export function normalizeCustomerId(raw:string){
 return String(raw||'').replace(/\D/g,'');
}

export function validateGoogleAdsCreds(raw:unknown):GoogleAdsCreds{
 const o=raw as Record<string,unknown>;
 if(!o||typeof o!=='object')throw Error('invalid_google_ads');
 const client_id=String(o.client_id||'').trim();
 const client_secret=String(o.client_secret||'').trim();
 const refresh_token=String(o.refresh_token||'').trim();
 const developer_token=String(o.developer_token||'').trim();
 const customer_id=normalizeCustomerId(String(o.customer_id||''));
 const login_customer_id=normalizeCustomerId(String(o.login_customer_id||''))||undefined;
 if(!client_id||!client_secret||!refresh_token||!developer_token||customer_id.length<6)throw Error('invalid_google_ads');
 return {client_id,client_secret,refresh_token,developer_token,customer_id,login_customer_id};
}

async function accessToken(c:GoogleAdsCreds){
 const res=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:'refresh_token'}),
  signal:AbortSignal.timeout(15000),
 });
 if(!res.ok)throw Error('google_auth_failed');
 const v=await res.json() as {access_token?:string};
 if(!v.access_token)throw Error('google_auth_failed');
 return v.access_token;
}

/** Returns daily spend in account currency units (cost_micros / 1e6). */
export async function fetchGoogleAdsDailySpend(c:GoogleAdsCreds,startDate:string,endDate:string):Promise<{date:string;spend:number}[]>{
 const token=await accessToken(c);
 const query=`SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${startDate}' AND '${endDate}' ORDER BY segments.date`;
 const headers:Record<string,string>={
  Authorization:`Bearer ${token}`,
  'developer-token':c.developer_token,
  'Content-Type':'application/json',
 };
 if(c.login_customer_id)headers['login-customer-id']=c.login_customer_id;
 const res=await fetch(`https://googleads.googleapis.com/v18/customers/${c.customer_id}/googleAds:searchStream`,{
  method:'POST',
  headers,
  body:JSON.stringify({query}),
  signal:AbortSignal.timeout(30000),
 });
 if(!res.ok){
  const t=await res.text().catch(()=>'');
  if(res.status===401||res.status===403)throw Error('google_ads_permission');
  if(res.status===400)throw Error('google_ads_bad_request');
  throw Error(`google_ads_http_${res.status}:${t.slice(0,120)}`);
 }
 const body=await res.json() as {results?:{segments?:{date?:string};metrics?:{costMicros?:string}}[]}[];
 const byDate=new Map<string,number>();
 for(const chunk of Array.isArray(body)?body:[body]){
  for(const row of chunk.results||[]){
   const date=row.segments?.date;
   const micros=Number(row.metrics?.costMicros||0);
   if(!date||!Number.isFinite(micros))continue;
   byDate.set(date,(byDate.get(date)||0)+micros/1e6);
  }
 }
 return [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,spend])=>({date,spend}));
}
