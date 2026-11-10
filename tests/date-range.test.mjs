import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presetRange,validateRange} from '../lib/date-range.mts';
import {parseQuery,reportsBody,parseReports} from '../lib/ga4-core.mts';
import {admobQuery,reportBody} from '../lib/admob-core.mts';
const filters={app:'bazi',country:'all',os:'all'};
test('presets handle Monday, year boundary and leap February',()=>{
 const now=new Date(2026,10,9,12);
 assert.deepEqual(presetRange('week',now),{startDate:'2026-11-02',endDate:'2026-11-08'});
 assert.deepEqual(presetRange('7',now),{startDate:'2026-11-02',endDate:'2026-11-08'});
 assert.deepEqual(presetRange('7today',now),{startDate:'2026-11-02',endDate:'2026-11-09'});
 assert.deepEqual(presetRange('month',now),{startDate:'2026-11-01',endDate:'2026-11-09'});
 assert.deepEqual(presetRange('lastMonth',new Date(2024,2,1)),{startDate:'2024-02-01',endDate:'2024-02-29'});
 assert.deepEqual(presetRange('3months',new Date(2026,0,5)),{startDate:'2025-10-01',endDate:'2025-12-31'});
});
test('both providers reject invalid, reversed, partial, future and oversized dates',()=>{
 for(const input of [{startDate:'2026-02-30',endDate:'2026-03-01'},{startDate:'2026-03-01',endDate:'2026-02-28'},{startDate:'2026-01-01'},{endDate:'2026-01-01'},{startDate:'2099-01-01',endDate:'2099-01-02'},{startDate:'2024-01-01',endDate:'2025-01-01'}])for(const parse of [parseQuery,admobQuery])assert.throws(()=>parse({...filters,...input}),/invalid_query/);
 assert.equal(validateRange('2024-01-01','2024-12-31').days,366);
 assert.equal(validateRange('2026-03-08','2026-03-08').days,1);
});
test('absolute range overrides days and reaches both GA4 requests and AdMob unchanged',()=>{
 const input={...filters,days:7,startDate:'2026-01-01',endDate:'2026-03-31'};
 const q=parseQuery(input);assert.equal(q.days,90);
 for(const request of reportsBody(q).requests)assert.deepEqual(request.dateRanges,[{startDate:input.startDate,endDate:input.endDate}]);
 assert.equal(reportsBody(q).requests[1].limit,'90');
 for(const tz of ['Asia/Seoul','America/Los_Angeles'])assert.deepEqual(reportBody(admobQuery(input),tz).reportSpec.dateRange,{startDate:{year:2026,month:1,day:1},endDate:{year:2026,month:3,day:31}});
});
test('long range DAU divides by every selected day including empty days',()=>{
 const q=parseQuery({...filters,startDate:'2026-01-01',endDate:'2026-03-31'});
 const data=parseReports({reports:[
  {metricHeaders:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'sessionsPerUser'}],rows:[{metricValues:[{value:'50'},{value:'100'},{value:'200'},{value:'10'},{value:'80'},{value:'0.8'},{value:'30'},{value:'2'}]}]},
  {metricHeaders:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],dimensionHeaders:[{name:'date'}],rowCount:40,rows:Array.from({length:40},(_,i)=>({dimensionValues:[{value:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10).replaceAll('-','')}],metricValues:[{value:'9'},{value:'1'},{value:'12'}]}))},
  {metricHeaders:[{name:'newUsers'}],dimensionHeaders:[{name:'firstUserSource'},{name:'firstUserMedium'}],rows:[]},
  {metricHeaders:[{name:'activeUsers'},{name:'newUsers'}],dimensionHeaders:[{name:'country'}],rows:[]},
  {metricHeaders:[{name:'activeUsers'}],dimensionHeaders:[{name:'appVersion'}],rows:[]},
 ]},q);
 assert.equal(data.averageDau,4);assert.equal(data.activeUsers,50);
});
