import type {AnchorHTMLAttributes} from 'react';
export default function Link(props:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}/>;}
export const useRouter=()=>({push:(url:string)=>{window.location.assign(url);}});
