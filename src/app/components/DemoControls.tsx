import { useState } from 'react';
import { Settings, X, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

export function DemoControls() {
  const [isOpen, setIsOpen] = useState(false);
  const { primaryColor, setPrimaryColor, isDark, toggleDark } = useTheme();

  const presetColors = [
    { name: 'UseSense', value: '#4F63F5' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
  ];

  return (
    <>
      {/* Floating settings button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center z-50"
      >
        <Settings size={24} />
      </motion.button>

      {/* Settings panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-xl z-50 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl">SDK Demo Settings</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Theme toggle */}
                <div className="mb-6">
                  <label className="block text-sm text-muted-foreground mb-3">Theme</label>
                  <button
                    onClick={toggleDark}
                    className="w-full h-14 rounded-xl border border-border flex items-center justify-between px-4 hover:bg-muted/50 transition-colors"
                  >
                    <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
                    {isDark ? <Moon size={20} /> : <Sun size={20} />}
                  </button>
                </div>

                {/* Primary color picker */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-3">Primary Color</label>
                  <div className="grid grid-cols-3 gap-3">
                    {presetColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setPrimaryColor(color.value)}
                        className="h-20 rounded-xl border-2 transition-all relative overflow-hidden"
                        style={{
                          backgroundColor: color.value,
                          borderColor: primaryColor === color.value ? color.value : 'transparent',
                          transform: primaryColor === color.value ? 'scale(0.95)' : 'scale(1)'
                        }}
                      >
                        <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium drop-shadow-md">
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info text */}
                <div className="mt-6 p-4 bg-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    This demo simulates the UseSense mobile SDK. In production, this would be embedded in your app with configurable branding.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}