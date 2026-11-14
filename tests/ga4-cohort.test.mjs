import test from 'node:test';
import assert from 'node:assert/strict';
import {cohortAbsoluteRange,cohortReportBody,eachDayInclusive,parseCohortReport} from '../lib/ga4-cohort.mts';

test('cohort absolute range uses picker dates when present',()=>{
 assert.deepEqual(cohortAbsoluteRange({app:'bazi',days:7,startDate:'2024-01-01',endDate:'2024-01-07',country:'all',os:'all'}),{startDate:'2024-01-01',endDate:'2024-01-07'});
});

test('eachDayInclusive lists every day',()=>{
 assert.deepEqual(eachDayInclusive('2024-01-01','2024-01-03'),['2024-01-01','2024-01-02','2024-01-03']);
});

test('cohort body uses single-day cohorts and daily offset',()=>{
 const body=cohortReportBody({app:'bazi',days:30,startDate:'2024-01-01',endDate:'2024-01-30',country:'all',os:'android'});
 assert.equal(body.cohortSpec.cohortsRange.granularity,'DAILY');
 assert.ok(body.cohortSpec.cohorts.length<=14);
 assert.equal(body.cohortSpec.cohorts[0].dateRange.startDate,body.cohortSpec.cohorts[0].dateRange.endDate);
 assert.equal(body.cohortSpec.cohortsRange.endOffset,14);
 assert.ok(body.dimensionFilter.andGroup.expressions.some(e=>e.filter?.fieldName==='operatingSystem'));
});

test('parseCohortReport builds matrix and averages',()=>{
 const data=parseCohortReport({
  dimensionHeaders:[{name:'cohort'},{name:'cohortNthDay'}],
  metricHeaders:[{name:'cohortActiveUsers'},{name:'cohortTotalUsers'},{name:'cohortRetentionRate'}],
  rows:[
   {dimensionValues:[{value:'2024-01-01'},{value:'0000'}],metricValues:[{value:'100'},{value:'100'},{value:'1'}]},
   {dimensionValues:[{value:'2024-01-01'},{value:'0001'}],metricValues:[{value:'40'},{value:'100'},{value:'0.4'}]},
   {dimensionValues:[{value:'2024-01-01'},{value:'0007'}],metricValues:[{value:'20'},{value:'100'},{value:'0.2'}]},
   {dimensionValues:[{value:'2024-01-02'},{value:'0000'}],metricValues:[{value:'50'},{value:'50'},{value:'1'}]},
   {dimensionValues:[{value:'2024-01-02'},{value:'0001'}],metricValues:[{value:'25'},{value:'50'},{value:'0.5'}]},
  ],
 });
 assert.equal(data.rows.length,2);
 assert.equal(data.rows[0].users,100);
 assert.equal(data.summary.d1,0.45);
 assert.equal(data.summary.d7,0.2);
 assert.equal(data.summary.d30,null);
});
