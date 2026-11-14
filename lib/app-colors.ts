/** Stable per-app chart/UI colors. Keep muted so the grayscale shell stays calm. */
const KNOWN:Record<string,string>={
 bazi:'#2F6B4F',
 sudoku:'#3B5BDB',
};
const FALLBACK=['#B45309','#7C3AED','#0F766E','#BE123C','#475569','#A16207'];

export function appColor(appId:string):string{
 if(KNOWN[appId])return KNOWN[appId];
 let hash=0;
 for(let i=0;i<appId.length;i++)hash=(hash*31+appId.charCodeAt(i))>>>0;
 return FALLBACK[hash%FALLBACK.length];
}

export function appColors():Readonly<Record<string,string>>{return {...KNOWN};}
