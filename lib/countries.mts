/** GA4 countryId / AdMob COUNTRY filter codes (ISO-3166 alpha-2). */
export const COUNTRY_CODES=['KR','JP','US','TW','VN','TH','ID','MY','SG','CN','DE','GB','BR','IN'] as const;
export type CountryCode=typeof COUNTRY_CODES[number];
export const COUNTRY_OPTIONS: {code:string;label:string}[]=[
 {code:'all',label:'전체 국가'},
 {code:'KR',label:'한국'},
 {code:'JP',label:'일본'},
 {code:'US',label:'미국'},
 {code:'TW',label:'대만'},
 {code:'VN',label:'베트남'},
 {code:'TH',label:'태국'},
 {code:'ID',label:'인도네시아'},
 {code:'MY',label:'말레이시아'},
 {code:'SG',label:'싱가포르'},
 {code:'CN',label:'중국'},
 {code:'DE',label:'독일'},
 {code:'GB',label:'영국'},
 {code:'BR',label:'브라질'},
 {code:'IN',label:'인도'},
];
export function isCountryFilter(value:unknown):value is 'all'|CountryCode{
 return value==='all'||(typeof value==='string'&&(COUNTRY_CODES as readonly string[]).includes(value));
}
