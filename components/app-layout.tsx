import { useState } from 'react';
import { AnimatedSidebar, MobileSidebarOverlay, MobileMenuButton } from './animated-sidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Animated Sidebar */}
      <div className="hidden md:block">
        <AnimatedSidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)} 
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <MobileSidebarOverlay 
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out",
          sidebarOpen ? "md:ml-[280px]" : "md:ml-[80px]"
        )}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <MobileMenuButton onClick={() => setMobileSidebarOpen(true)} />
          <h1 className="text-lg font-semibold text-gray-900">Calendar</h1>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}