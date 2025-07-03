import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDays, 
  Settings, 
  Users, 
  FileText, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

interface AnimatedSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

const sidebarVariants = {
  open: {
    width: 280,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      duration: 0.4
    }
  },
  closed: {
    width: 80,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      duration: 0.4
    }
  }
};

const contentVariants = {
  open: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.2,
      duration: 0.3,
      ease: "easeOut"
    }
  },
  closed: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  }
};

const iconVariants = {
  open: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  closed: {
    scale: 1.1,
    rotate: 5,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  }
};

const menuItems = [
  { icon: CalendarDays, label: 'Calendar', href: '/' },
  { icon: Users, label: 'Attendees', href: '/attendees' },
  { icon: FileText, label: 'Categories', href: '/categories' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: Settings, label: 'Settings', href: '/settings' }
];

export function AnimatedSidebar({ isOpen, onToggle, className }: AnimatedSidebarProps) {
  const [location] = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <motion.div
      className={cn(
        "fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 shadow-2xl z-50",
        "backdrop-blur-sm bg-opacity-95",
        className
      )}
      variants={sidebarVariants}
      animate={isOpen ? "open" : "closed"}
      initial="closed"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              variants={contentVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-lg">Calendar</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onClick={onToggle}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </motion.div>
        </motion.button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 5 }}
              onHoverStart={() => setHoveredItem(item.href)}
              onHoverEnd={() => setHoveredItem(null)}
            >
              <Link href={item.href}>
                <motion.div
                  className={cn(
                    "flex items-center p-3 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden",
                    isActive 
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg" 
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"
                      layoutId="activeIndicator"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  
                  {/* Hover effect */}
                  {hoveredItem === item.href && !isActive && (
                    <motion.div
                      className="absolute inset-0 bg-slate-600 rounded-xl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.3 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  
                  <motion.div
                    className="relative z-10"
                    variants={iconVariants}
                    animate={isOpen ? "open" : "closed"}
                  >
                    <Icon className={cn(
                      "w-6 h-6 transition-colors",
                      isActive ? "text-white" : "text-slate-400"
                    )} />
                  </motion.div>
                  
                  <AnimatePresence mode="wait">
                    {isOpen && (
                      <motion.span
                        variants={contentVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        className="ml-4 font-medium relative z-10"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              variants={contentVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="text-xs text-slate-500 text-center"
            >
              Calendar Scheduling App
              <br />
              v1.0.0
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Mobile Sidebar Overlay
export function MobileSidebarOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Mobile Sidebar */}
          <motion.div
            className="fixed left-0 top-0 h-full w-80 bg-slate-900 shadow-2xl z-50 md:hidden"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-semibold text-lg">Calendar</span>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="p-4 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className="flex items-center p-3 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 cursor-pointer"
                      onClick={onClose}
                    >
                      <Icon className="w-6 h-6 text-slate-400" />
                      <span className="ml-4 font-medium">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Mobile Menu Button
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Menu className="w-6 h-6" />
    </motion.button>
  );
}