import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-void">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto app-main relative">
          <div className="max-w-[1440px] mx-auto p-6 md:p-8 lg:p-12 relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
