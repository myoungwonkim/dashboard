import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseQuery,reportsBody,crashBody,parseReports,accessToken,fetchReport} from '../lib/ga4-core.mts';
const query={app:'bazi',days:7,country:'KR',os:'android'};
const reports={reports:[
 {metricHeaders:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'sessionsPerUser'}],rows:[{metricValues:[{value:'10'},{value:'40'},{value:'70'},{value:'3'},{value:'28'},{value:'0.7'},{value:'45.5'},{value:'4.0'}]}],metadata:{timeZone:'Asia/Seoul'}},
 {metricHeaders:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],dimensionHeaders:[{name:'date'}],rows:[{dimensionValues:[{value:'20261101'}],metricValues:[{value:'8'},{value:'2'},{value:'12'}]},{dimensionValues:[{value:'20261102'}],metricValues:[{value:'6'},{value:'1'},{value:'9'}]}]},
 {metricHeaders:[{name:'newUsers'}],dimensionHeaders:[{name:'firstUserSource'},{name:'firstUserMedium'}],rows:[{dimensionValues:[{value:'google'},{value:'organic'}],metricValues:[{value:'2'}]}]},
 {metricHeaders:[{name:'activeUsers'},{name:'newUsers'}],dimensionHeaders:[{name:'country'}],rows:[{dimensionValues:[{value:'South Korea'}],metricValues:[{value:'9'},{value:'2'}]}]},
 {metricHeaders:[{name:'activeUsers'}],dimensionHeaders:[{name:'appVersion'}],rows:[{dimensionValues:[{value:'1.2.0'}],metricValues:[{value:'7'}]}]},
]};
const crash={reports:[{metricHeaders:[{name:'crashAffectedUsers'},{name:'crashFreeUsersRate'}],rows:[{metricValues:[{value:'1'},{value:'0.95'}]}]}]};
test('only slug app IDs and bounded filters accepted',()=>{assert.deepEqual(parseQuery(query),query);for(const patch of [{app:'550050295'},{app:'__proto__'},{days:365},{country:'ZZ'},{os:'web'}])assert.throws(()=>parseQuery({...query,...patch}));assert.deepEqual(parseQuery({...query,app:'new-game'}).app,'new-game');});
test('filters and yesterday-relative dates apply to both reports',()=>{const requests=reportsBody(query).requests;assert.equal(requests.length,5);assert.equal(requests[0].dateRanges[0].startDate,'7daysAgo');assert.equal(requests[0].dateRanges[0].endDate,'yesterday');assert.deepEqual(requests[0].dimensionFilter,requests[1].dimensionFilter);assert.equal(requests[0].dimensionFilter.andGroup.expressions.length,3);assert.equal(crashBody(query).requests[0].metrics.map(m=>m.name).join(','),'crashAffectedUsers,crashFreeUsersRate');});
test('period users never summed from daily counts; missing days remain in denominator',()=>{const data=parseReports(reports,query,'550050295',crash);assert.equal(data.activeUsers,10);assert.equal(data.averageDau,2);assert.equal(data.sessions,40);assert.equal(data.newUsers,3);assert.equal(data.engagementRate,0.7);assert.equal(data.crashFreeUsersRate,0.95);assert.equal(data.firstUser[0].source,'google');assert.equal(data.countries[0].country,'South Korea');assert.equal(data.versions[0].version,'1.2.0');assert.equal(data.timeZone,'Asia/Seoul');});
test('valid empty reports yield zero, malformed reports do not',()=>{const empty=structuredClone(reports);empty.reports.forEach(r=>delete r.rows);assert.equal(parseReports(empty,query,'550050295').activeUsers,0);assert.throws(()=>parseReports({},query,'550050295'));const broken=structuredClone(reports);broken.reports[0].rows[0].metricValues[0].value='oops';assert.throws(()=>parseReports(broken,query,'550050295'));});
test('missing credentials cause no external requests',async()=>{let called=false;await assert.rejects(accessToken('','',async()=>{called=true;}),/not_configured/);assert.equal(called,false);});
test('provider errors are classified without leaking response body',async()=>{for(const [status,code] of [[403,'permission_denied'],[429,'quota_exceeded'],[401,'authentication_failed']])await assert.rejects(fetchReport(query,'secret',async()=>new Response('sensitive upstream details',{status})),error=>error.code===code&&!error.message.includes('sensitive'));});
test('batch URL is server-selected, successful response parsed',async()=>{let calls=0;const result=await fetchReport(query,'test-token',async(url,options)=>{calls++;assert.ok(url.endsWith('/properties/550050295:batchRunReports'));assert.equal(options.headers.Authorization,'Bearer test-token');const body=JSON.parse(options.body);return Response.json(body.requests.length===1?crash:reports);});assert.equal(result.activeUsers,10);assert.equal(result.crashAffectedUsers,1);assert.ok(calls>=2);});
test('JWT signature, scope and fixed token audience are correct',async()=>{const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const pkcs8=await crypto.subtle.exportKey('pkcs8',keys.privateKey);const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(pkcs8).toString('base64')+'\n-----END PRIVATE KEY-----';const result=await accessToken('dashboard@test.iam.gserviceaccount.com',pem,async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');const jwt=options.body.get('assertion'),[head,payload,signature]=jwt.split('.');const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.scope,'https://www.googleapis.com/auth/analytics.readonly');assert.equal(claims.aud,url);assert.equal(claims.exp-claims.iat,3600);assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(head+'.'+payload)),true);return Response.json({access_token:'mock-token'});});assert.equal(result,'mock-token');});

test('SERVICE_DISABLED is distinguished from property access denial without leaking metadata',async()=>{
 const {fetchReport}=await import('../lib/ga4-core.mts');
 const q={app:'bazi',days:7,country:'all',os:'all'};
 await assert.rejects(fetchReport(q,'token',async()=>new Response(JSON.stringify({error:{message:'sensitive',details:[{reason:'SERVICE_DISABLED',metadata:{secret:'hidden'}}]}}),{status:403})),e=>e.code==='api_disabled'&&!e.message.includes('hidden'));
});
test('a failed first property does not prevent checking the second property',async()=>{
 const {verifyProperties}=await import('../lib/ga4-core.mts');const calls=[];
 const result=await verifyProperties('token',async url=>{calls.push(url);return new Response('{}',{status:403});});
 assert.equal(calls.length,2);assert.deepEqual(result.map(r=>[r.app,r.ok,r.code]),[['bazi',false,'permission_denied'],['sudoku',false,'permission_denied']]);
});
test('setup probe uses a single activeUsers request not the deep P1 batch',async()=>{
 const {probeProperty}=await import('../lib/ga4-core.mts');
 let body=null;
 await probeProperty('550050295','tok',async(_url,options)=>{
  body=JSON.parse(options.body);
  return Response.json({reports:[{metricHeaders:[{name:'activeUsers'}],rows:[{metricValues:[{value:'1'}]}]}]});
 });
 assert.equal(body.requests.length,1);
 assert.deepEqual(body.requests[0].metrics,[{name:'activeUsers'}]);
});
test('crash report failure still returns main metrics',async()=>{
 let n=0;
 const result=await fetchReport(query,'tok',async(_url,options)=>{
  n++;
  const body=JSON.parse(options.body);
  if(body.requests.length===1)return new Response('nope',{status:500});
  return Response.json(reports);
 });
 assert.equal(result.newUsers,3);
 assert.equal(result.crashAffectedUsers,null);
 assert.ok(n>=2);
});
test('deep batch failure falls back to core totals and daily',async()=>{
 const coreOnly={reports:[reports.reports[0],reports.reports[1]]};
 let deepTried=false;
 const result=await fetchReport(query,'tok',async(_url,options)=>{
  const body=JSON.parse(options.body);
  if(body.requests.length===1)return new Response('nope',{status:500});
  if(body.requests.length===5){deepTried=true;return new Response('nope',{status:500});}
  if(body.requests[0].metrics.length===8)return Response.json(coreOnly);
  return new Response('nope',{status:500});
 });
 assert.equal(deepTried,true);
 assert.equal(result.activeUsers,10);
 assert.equal(result.firstUser.length,0);
});
test('unparseable deep payload retries with sliced core reports',async()=>{
 const badDeep={reports:[reports.reports[0],reports.reports[1],{metricHeaders:[{name:'weird'}],rows:[{dimensionValues:[{value:''}],metricValues:[{value:'x'}]}]},reports.reports[3],reports.reports[4]]};
 // firstUser-like third report is malformed enough that older parsers threw; slice(0,2) still works.
 const data=parseReports({reports:badDeep.reports.slice(0,2)},query,'550050295');
 assert.equal(data.activeUsers,10);
 const result=await fetchReport(query,'tok',async(_url,options)=>{
  const body=JSON.parse(options.body);
  if(body.requests.length===1)return new Response('nope',{status:500});
  if(body.requests.length===5)return Response.json(badDeep);
  if(body.requests[0].metrics.length===8)return Response.json({reports:[reports.reports[0],reports.reports[1]]});
  return Response.json({reports:[
   {metricHeaders:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'}],rows:[{metricValues:[{value:'10'},{value:'40'},{value:'70'},{value:'3'}]}]},
   reports.reports[1],
  ]});
 });
 assert.equal(result.activeUsers,10);
});
test('core-only report payload parses without breakdown tables',()=>{
 const core={reports:[reports.reports[0],reports.reports[1]]};
 const data=parseReports(core,query,'550050295');
 assert.equal(data.sessions,40);
 assert.deepEqual(data.countries,[]);
});
test('scientific notation and empty dimension values do not fail the report',()=>{
 const payload={reports:[
  {metricHeaders:[{name:'activeUsers'},{name:'sessions'},{name:'eventCount'},{name:'newUsers'},{name:'engagedSessions'},{name:'engagementRate'},{name:'averageSessionDuration'},{name:'sessionsPerUser'}],rows:[{metricValues:[{value:'1e1'},{value:'40'},{value:'70'},{value:'3'},{value:'28'},{value:'7.0E-1'},{value:'45.5'},{value:'4.0'}]}]},
  {metricHeaders:[{name:'activeUsers'},{name:'newUsers'},{name:'sessions'}],dimensionHeaders:[{name:'date'}],rows:[{dimensionValues:[{value:'20261101'}],metricValues:[{value:'8'},{value:'2'},{value:'12'}]}]},
  {metricHeaders:[{name:'newUsers'}],dimensionHeaders:[{name:'firstUserSource'},{name:'firstUserMedium'}],rows:[{dimensionValues:[{value:''},{value:''}],metricValues:[{value:'2'}]}]},
  {metricHeaders:[{name:'activeUsers'},{name:'newUsers'}],dimensionHeaders:[{name:'country'}],rows:[]},
  {metricHeaders:[{name:'activeUsers'}],dimensionHeaders:[{name:'appVersion'}],rows:[]},
 ]};
 const data=parseReports(payload,query,'558243778');
 assert.equal(data.activeUsers,10);
 assert.equal(data.engagementRate,0.7);
 assert.equal(data.firstUser[0].source,'(not set)');
});
