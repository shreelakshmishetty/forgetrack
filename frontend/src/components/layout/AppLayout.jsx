import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-void">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto app-main relative bg-canvas">
          <div className="w-full px-8 md:px-12 lg:px-16 py-8 md:py-12 relative z-10 min-h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
