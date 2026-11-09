import {createInterface} from 'node:readline/promises';
import {spawn} from 'node:child_process';
export async function prompt(label,hidden=false){
 if(!process.stdin.isTTY)throw Error('터미널에서 실행해 주세요.');
 if(!hidden){const rl=createInterface({input:process.stdin,output:process.stdout});try{return await rl.question(label);}finally{rl.close();}}
 process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const finish=()=>{process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const read=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){finish();reject(Error('취소했습니다.'));return;}if(char==='\r'||char==='\n'){finish();resolve(value);return;}if(char==='\u007f'){value=[...value].slice(0,-1).join('');}else if(char>=' ')value+=char;}};process.stdin.on('data',read);});
}
export async function upload(values){const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk'],{stdio:['pipe','inherit','inherit']});child.stdin.end(JSON.stringify(values));await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('비밀값 등록 실패')));});}
