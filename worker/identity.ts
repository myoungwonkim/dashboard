import {AsyncLocalStorage} from 'node:async_hooks';
const identity=new AsyncLocalStorage<{userId:string}>();
export const withUser=<T>(fn:()=>T)=>identity.run({userId:'owner'},fn);
export const getCurrentUser=async()=>identity.getStore()||null;
