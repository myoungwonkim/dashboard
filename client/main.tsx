import {createRoot} from 'react-dom/client';
import Dashboard from '../components/dashboard';
import '../app/globals.css';
function resolvePage(pathname:string){
 if(pathname==='/')return 'overview';
 if(pathname==='/connections')return 'connections';
 if(pathname==='/progress')return 'progress';
 const match=pathname.match(/^\/apps\/([a-z][a-z0-9-]{0,31})$/);
 if(match)return match[1];
 return null;
}
const page=resolvePage(location.pathname);
createRoot(document.getElementById('root')!).render(page?<Dashboard page={page}/>:<main><h1>페이지를 찾을 수 없습니다.</h1><a href="/">대시보드로 돌아가기</a></main>);
window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
