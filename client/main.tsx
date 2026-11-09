import {createRoot} from 'react-dom/client';
import Dashboard from '../components/dashboard';
import '../app/globals.css';
const pages:Record<string,string>={'/':'overview','/apps/bazi':'bazi','/apps/sudoku':'sudoku','/connections':'connections','/progress':'progress'};
createRoot(document.getElementById('root')!).render(pages[location.pathname]?<Dashboard page={pages[location.pathname]}/>:<main><h1>페이지를 찾을 수 없습니다.</h1><a href="/">대시보드로 돌아가기</a></main>);
window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
