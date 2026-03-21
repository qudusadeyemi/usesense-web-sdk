import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { Shield, CircleAlert, ExternalLink } from 'lucide-react';

type PermissionState = 'initial' | 'denied';

export default function CameraRequestScreen() {
  const { primaryColor } = useTheme();
  const navigate = useNavigate();
  const [permissionState, setPermissionState] = useState<PermissionState>('initial');

  const handleAllowCamera = async () => {
    try {
      // Simulate camera permission request
      // In production: await navigator.mediaDevices.getUserMedia({ video: true });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // On success, navigate to face alignment screen
      navigate('/ui-preview/face-alignment');
    } catch (error) {
      // Only show denied state if there's an actual error
      setPermissionState('denied');
    }
  };

  const handleNotNow = () => {
    console.log('User declined camera access');
    // Navigate back to intro or handle dismissal
    navigate('/');
  };

  const handleOpenSettings = () => {
    console.log('Opening system settings...');
    // In production, show platform-specific instructions
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 pb-8">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pt-4"
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#4F63F5' }}
          >
            <Shield 
              className="w-5 h-5 text-white" 
              strokeWidth={2.5}
              fill="white"
            />
          </div>
          <span className="text-lg font-semibold">UseSense</span>
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        <AnimatePresence mode="wait">
          {/* Initial Request State */}
          {permissionState === 'initial' && (
            <motion.div
              key="initial"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              {/* Phone Camera Illustration */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-10 flex justify-center"
              >
                <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
                  {/* Phone body */}
                  <rect
                    x="40"
                    y="20"
                    width="80"
                    height="120"
                    rx="12"
                    fill="currentColor"
                    className="text-foreground"
                  />
                  <rect
                    x="44"
                    y="24"
                    width="72"
                    height="112"
                    rx="8"
                    fill="currentColor"
                    className="text-background"
                  />
                  
                  {/* Screen */}
                  <rect
                    x="48"
                    y="36"
                    width="64"
                    height="88"
                    rx="4"
                    fill="currentColor"
                    className="text-muted"
                  />
                  
                  {/* Camera module at top */}
                  <motion.g
                    animate={{
                      opacity: [1, 0.6, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  >
                    <rect
                      x="68"
                      y="28"
                      width="24"
                      height="4"
                      rx="2"
                      fill="currentColor"
                      className="text-muted-foreground"
                    />
                    <circle
                      cx="70"
                      cy="30"
                      r="2"
                      fill={primaryColor}
                    />
                  </motion.g>

                  {/* Camera icon on screen */}
                  <g transform="translate(80, 80)">
                    <circle
                      r="20"
                      fill={`${primaryColor}15`}
                    />
                    <circle
                      r="14"
                      fill={`${primaryColor}30`}
                    />
                    <path
                      d="M-6,-2 L-2,-6 L2,-6 L6,-2 L6,6 L-6,6 Z"
                      fill={primaryColor}
                    />
                    <circle
                      cy="1"
                      r="3"
                      fill="white"
                    />
                    <circle
                      cx="3"
                      cy="-4"
                      r="1"
                      fill={primaryColor}
                    />
                  </g>

                  {/* Scan lines effect */}
                  <motion.line
                    x1="48"
                    x2="112"
                    y1="80"
                    y2="80"
                    stroke={primaryColor}
                    strokeWidth="2"
                    opacity="0.3"
                    animate={{
                      y1: [36, 124, 36],
                      y2: [36, 124, 36],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                  />
                </svg>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <h1 className="text-2xl mb-3">We need access to your camera</h1>
                <p className="text-muted-foreground leading-relaxed px-4">
                  This helps us confirm you're physically present.
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* Permission Denied State */}
          {permissionState === 'denied' && (
            <motion.div
              key="denied"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mb-8 flex justify-center"
              >
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#fef2f2' }}
                >
                  <CircleAlert 
                    size={40} 
                    className="text-red-500"
                    strokeWidth={2}
                  />
                </div>
              </motion.div>

              <h1 className="text-2xl mb-3">Camera access denied</h1>
              <p className="text-muted-foreground leading-relaxed mb-8 px-4">
                We need camera permission to verify your identity. Please enable it in your settings.
              </p>

              {/* Instructions */}
              <div className="bg-muted/50 rounded-2xl p-5 text-left space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <span className="text-sm font-semibold" style={{ color: primaryColor }}>1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Open Settings</p>
                    <p className="text-xs text-muted-foreground">
                      Go to your device Settings app
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <span className="text-sm font-semibold" style={{ color: primaryColor }}>2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Find this app</p>
                    <p className="text-xs text-muted-foreground">
                      Locate your app in the permissions list
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <span className="text-sm font-semibold" style={{ color: primaryColor }}>3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Enable Camera</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle on Camera permission
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenSettings}
                className="w-full h-14 rounded-xl border-2 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-3"
                style={{ 
                  borderColor: primaryColor,
                  color: primaryColor
                }}
              >
                <ExternalLink size={20} />
                Open Settings
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="w-full max-w-sm space-y-3"
      >
        {permissionState === 'initial' && (
          <>
            <button
              onClick={handleAllowCamera}
              className="w-full h-14 rounded-xl text-white transition-all active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
            >
              Allow Camera Access
            </button>
            
            <button
              onClick={handleNotNow}
              className="w-full h-14 text-muted-foreground transition-all active:scale-[0.98]"
            >
              Not now
            </button>
          </>
        )}

        {permissionState === 'denied' && (
          <button
            onClick={() => setPermissionState('initial')}
            className="w-full h-14 text-muted-foreground transition-all active:scale-[0.98]"
          >
            Go back
          </button>
        )}
      </motion.div>
    </div>
  );
}