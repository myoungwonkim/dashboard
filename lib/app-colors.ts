/** Stable per-app chart/UI colors. Warm vs cool pair so series stay easy to tell apart. */
const KNOWN:Record<string,string>={
 bazi:'#C2410C',   // amber-orange — distinct from sudoku blue
 sudoku:'#1D4ED8', // strong blue
};
const FALLBACK=['#0F766E','#7C3AED','#BE123C','#475569','#A16207','#2F6B4F'];

export function appColor(appId:string):string{
 if(KNOWN[appId])return KNOWN[appId];
 let hash=0;
 for(let i=0;i<appId.length;i++)hash=(hash*31+appId.charCodeAt(i))>>>0;
 return FALLBACK[hash%FALLBACK.length];
}

export function appColors():Readonly<Record<string,string>>{return {...KNOWN};}
