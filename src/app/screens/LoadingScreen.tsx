import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { CircleAlert, Camera, RotateCw, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

type LoadingState = 'loading' | 'permission' | 'error';

interface LoadingScreenProps {
  state?: LoadingState;
  onRetry?: () => void;
  onRequestPermission?: () => void;
}

export default function LoadingScreen({ 
  state: propState,
  onRetry,
  onRequestPermission 
}: LoadingScreenProps = {}) {
  const { primaryColor } = useTheme();
  const [dots, setDots] = useState('');
  const [demoState, setDemoState] = useState<LoadingState>('loading');
  
  // Use prop state if provided, otherwise use demo state
  const state = propState ?? demoState;
  
  // Auto-cycle through states for demo
  useEffect(() => {
    if (propState !== undefined) return; // Don't auto-cycle if controlled
    
    const timer = setTimeout(() => {
      setDemoState(current => {
        if (current === 'loading') return 'permission';
        if (current === 'permission') return 'error';
        return 'loading';
      });
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [demoState, propState]);

  useEffect(() => {
    if (state !== 'loading') return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [state]);
  
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      setDemoState('loading');
    }
  };
  
  const handleRequestPermission = () => {
    if (onRequestPermission) {
      onRequestPermission();
    } else {
      console.log('Opening settings...');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 pb-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-16"
        >
          <div className="flex flex-col items-center gap-3">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#4F63F5' }}
            >
              <Shield 
                className="w-8 h-8 text-white" 
                strokeWidth={2.5}
                fill="white"
              />
            </div>
            <span className="text-2xl font-semibold">UseSense</span>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Loading State */}
          {state === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              {/* Progress Indicator */}
              <div className="flex justify-center mb-8">
                <div className="relative w-20 h-20">
                  {/* Outer ring */}
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      className="text-muted"
                      opacity="0.2"
                    />
                    <motion.circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke={primaryColor}
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: [0, 0.8, 0.2, 0.8] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      style={{
                        pathLength: 0,
                        strokeDasharray: '1 1'
                      }}
                    />
                  </svg>

                  {/* Center pulse */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <motion.div
                      className="w-12 h-12 rounded-full"
                      style={{ backgroundColor: `${primaryColor}15` }}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                  </motion.div>
                </div>
              </div>

              <h1 className="text-2xl mb-3">
                Verifying your presence
                <span className="inline-block w-8 text-left">{dots}</span>
              </h1>
              <p className="text-muted-foreground">
                This will only take a moment.
              </p>
            </motion.div>
          )}

          {/* Permission State */}
          {state === 'permission' && (
            <motion.div
              key="permission"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              <div className="flex justify-center mb-8">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Camera 
                    size={36} 
                    style={{ color: primaryColor }}
                    strokeWidth={2}
                  />
                </div>
              </div>

              <h1 className="text-2xl mb-3">Camera permission needed</h1>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Please allow camera access in your browser settings to continue verification.
              </p>

              <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3">
                <p className="text-sm font-medium">How to enable:</p>
                <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                  <li>Look for the camera icon in your address bar</li>
                  <li>Select "Allow" for camera permissions</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              <div className="flex justify-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#fef2f2' }}
                  >
                    <CircleAlert 
                      size={36} 
                      className="text-red-500"
                      strokeWidth={2}
                    />
                  </div>
                </motion.div>
              </div>

              <h1 className="text-2xl mb-3">Something went wrong</h1>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We couldn't complete the verification. This might be due to:
              </p>

              <div className="bg-muted/50 rounded-xl p-4 text-left mb-6">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Poor lighting conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Camera not positioned correctly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Network connection issues</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleRetry}
                className="w-full h-14 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: primaryColor,
                  color: 'white'
                }}
              >
                <RotateCw size={20} />
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom helper text */}
      {state === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground">
            Secured by UseSense
          </p>
        </motion.div>
      )}

      {/* Permission button */}
      {state === 'permission' && onRequestPermission && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={handleRequestPermission}
          className="w-full max-w-sm h-14 rounded-xl text-white transition-all active:scale-[0.98]"
          style={{ backgroundColor: primaryColor }}
        >
          Open settings
        </motion.button>
      )}
    </div>
  );
}