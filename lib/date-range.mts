export type DateRange={startDate:string;endDate:string};
const DAY=86400000;
export const dateISO=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function dateMillis(value:unknown):number{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('invalid_query');
 const ms=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)throw Error('invalid_query');
 return ms;
}
export function validateRange(startDate:unknown,endDate:unknown,latest=new Date(Date.now()+14*3600000).toISOString().slice(0,10)){
 const start=dateMillis(startDate),end=dateMillis(endDate),days=(end-start)/DAY+1;
 if(days<1||days>366||start<dateMillis('2005-01-01')||end>dateMillis(latest))throw Error('invalid_query');
 return {startDate:startDate as string,endDate:endDate as string,days};
}
export function queryDates(v:Record<string,unknown>):{days:number;startDate?:string;endDate?:string}{
 if(v.startDate!==undefined||v.endDate!==undefined)return validateRange(v.startDate,v.endDate);
 if(![7,14,30].includes(Number(v.days)))throw Error('invalid_query');
 return {days:Number(v.days)};
}
export const presets=[['yesterday','어제'],['7','최근 7일'],['7today','최근 7일 + 오늘'],['week','지난주'],['30','최근 30일'],['month','이번 달'],['lastMonth','지난달'],['2months','지난 2개월'],['3months','지난 3개월']] as const;
export function presetRange(id:string,now=new Date()):DateRange{
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const shift=(days:number)=>new Date(today.getFullYear(),today.getMonth(),today.getDate()+days);
 let start=shift(-7),end=shift(-1);
 switch(id){
 case 'yesterday':start=end;break;
 case '7today':end=today;break;
 case 'week':{const monday=-(today.getDay()+6)%7;start=shift(monday-7);end=shift(monday-1);break;}
 case '30':start=shift(-30);break;
 case 'month':start=new Date(today.getFullYear(),today.getMonth(),1);end=today;break;
 case 'lastMonth':case '2months':case '3months':{const n=id==='lastMonth'?1:id==='2months'?2:3;start=new Date(today.getFullYear(),today.getMonth()-n,1);end=new Date(today.getFullYear(),today.getMonth(),0);break;}
 }
 return {startDate:dateISO(start),endDate:dateISO(end)};
}
