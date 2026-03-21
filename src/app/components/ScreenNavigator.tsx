import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

const screens = [
  { path: '/ui-preview', name: 'Intro' },
  { path: '/ui-preview/camera-request', name: 'Camera Request' },
  { path: '/ui-preview/face-alignment', name: 'Face Alignment' },
  { path: '/ui-preview/micro-challenge', name: 'Micro Challenge' },
  { path: '/ui-preview/audio-prompt', name: 'Audio Prompt' },
  { path: '/ui-preview/processing', name: 'Processing' },
  { path: '/ui-preview/success', name: 'Success' },
  { path: '/ui-preview/failure', name: 'Failure' },
  { path: '/ui-preview/blocked', name: 'Blocked' },
  { path: '/ui-preview/loading', name: 'Loading' },
];

export default function ScreenNavigator() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gray-900 text-white shadow-2xl flex items-center justify-center z-50 hover:scale-110 transition-transform"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </motion.button>

      {/* Navigation Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 w-64 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 bg-gray-900 text-white">
                <h3 className="font-semibold text-lg">Screen Navigator</h3>
                <p className="text-sm text-gray-400 mt-0.5">Demo all SDK screens</p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {screens.map((screen) => {
                  const isActive = location.pathname === screen.path;
                  return (
                    <button
                      key={screen.path}
                      onClick={() => handleNavigate(screen.path)}
                      className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{screen.name}</span>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">
                  UseSense SDK • Flow Demo
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}