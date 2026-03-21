import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { Shield, CircleAlert, Check } from 'lucide-react';

type FeedbackState = 'too-dark' | 'move-closer' | 'hold-steady' | 'face-detected' | 'capturing';

interface FeedbackConfig {
  state: FeedbackState;
  message: string;
  icon: 'warning' | 'info' | 'success';
  guideColor: string;
}

export default function FaceAlignmentScreen() {
  const { primaryColor } = useTheme();
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackState>('too-dark');
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);

  const feedbackConfigs: Record<FeedbackState, FeedbackConfig> = {
    'too-dark': {
      state: 'too-dark',
      message: 'Too dark',
      icon: 'warning',
      guideColor: '#f59e0b'
    },
    'move-closer': {
      state: 'move-closer',
      message: 'Move closer',
      icon: 'info',
      guideColor: '#3b82f6'
    },
    'hold-steady': {
      state: 'hold-steady',
      message: 'Hold steady',
      icon: 'info',
      guideColor: primaryColor
    },
    'face-detected': {
      state: 'face-detected',
      message: 'Face detected',
      icon: 'success',
      guideColor: '#10b981'
    },
    'capturing': {
      state: 'capturing',
      message: 'Capturing...',
      icon: 'success',
      guideColor: '#10b981'
    }
  };

  // Simulate progression through feedback states
  useEffect(() => {
    const sequence: FeedbackState[] = ['too-dark', 'move-closer', 'hold-steady', 'face-detected'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex < sequence.length) {
        setCurrentFeedback(sequence[currentIndex]);
      } else {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Auto capture countdown when face detected
  useEffect(() => {
    if (currentFeedback === 'face-detected') {
      setCaptureCountdown(3);
      
      const countdownInterval = setInterval(() => {
        setCaptureCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            setCurrentFeedback('capturing');
            
            // Simulate capture completion
            setTimeout(() => {
              console.log('Photo captured - navigating to next screen');
            }, 1000);
            
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [currentFeedback]);

  const config = feedbackConfigs[currentFeedback];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#4F63F5' }}
            >
              <Shield 
                className="w-4 h-4 text-white" 
                strokeWidth={2.5}
                fill="white"
              />
            </div>
            <span className="text-white font-semibold">UseSense</span>
          </div>
          
          <button 
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
            onClick={() => console.log('Close')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Camera Preview Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Simulated camera feed */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900">
          {/* Noise/grain effect */}
          <div className="absolute inset-0 opacity-10" 
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' /%3E%3C/svg%3E")',
              backgroundSize: '200px 200px'
            }}
          />
        </div>

        {/* Vignette overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.6) 100%)'
          }}
        />

        {/* Face Guide Overlay */}
        <div className="relative z-10 flex items-center justify-center">
          <div className="relative w-72 h-80">
            {/* Circular face guide */}
            <svg
              viewBox="0 0 288 320"
              fill="none"
              className="w-full h-full"
            >
              {/* Main oval guide */}
              <motion.ellipse
                cx="144"
                cy="160"
                rx="120"
                ry="140"
                stroke={config.guideColor}
                strokeWidth="4"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: 1, 
                  opacity: [0.6, 0.9, 0.6],
                }}
                transition={{
                  pathLength: { duration: 0.8, ease: 'easeOut' },
                  opacity: { 
                    duration: 2, 
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }
                }}
              />

              {/* Corner brackets */}
              {[[40, 40], [248, 40], [40, 280], [248, 280]].map(([x, y], i) => {
                const isLeft = i % 2 === 0;
                const isTop = i < 2;
                return (
                  <motion.g
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    <line
                      x1={x}
                      y1={y}
                      x2={x + (isLeft ? 20 : -20)}
                      y2={y}
                      stroke={config.guideColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <line
                      x1={x}
                      y1={y}
                      x2={x}
                      y2={y + (isTop ? 20 : -20)}
                      stroke={config.guideColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </motion.g>
                );
              })}

              {/* Animated border pulse */}
              <motion.ellipse
                cx="144"
                cy="160"
                rx="120"
                ry="140"
                stroke={config.guideColor}
                strokeWidth="2"
                fill="none"
                opacity="0.3"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            </svg>

            {/* Countdown overlay */}
            <AnimatePresence>
              {captureCountdown !== null && (
                <motion.div
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                  >
                    <motion.span 
                      key={captureCountdown}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-4xl font-bold text-white"
                    >
                      {captureCountdown}
                    </motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Capturing flash effect */}
            <AnimatePresence>
              {currentFeedback === 'capturing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-white rounded-full"
                  style={{ 
                    filter: 'blur(20px)',
                    transform: 'scale(1.2)'
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Text Instructions - Top */}
        <div className="absolute top-32 left-0 right-0 text-center px-6 z-20">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-white text-2xl mb-2">Position your face in the frame</h1>
            <p className="text-white/70 text-sm">Make sure you're in good lighting.</p>
          </motion.div>
        </div>

        {/* Live Feedback - Bottom */}
        <div className="absolute bottom-32 left-0 right-0 flex justify-center px-6 z-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeedback}
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-2"
              style={{ 
                backgroundColor: `${config.guideColor}20`,
                border: `2px solid ${config.guideColor}`
              }}
            >
              {config.icon === 'warning' && (
                <CircleAlert size={20} style={{ color: config.guideColor }} strokeWidth={2.5} />
              )}
              {config.icon === 'info' && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config.guideColor }}
                  />
                </motion.div>
              )}
              {config.icon === 'success' && (
                <Check size={20} style={{ color: config.guideColor }} strokeWidth={2.5} />
              )}
              <span 
                className="font-medium text-sm"
                style={{ color: config.guideColor === '#f59e0b' ? '#fbbf24' : config.guideColor }}
              >
                {config.message}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Accessibility Note */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pb-8 px-6 text-center"
      >
        <p className="text-white/50 text-xs leading-relaxed">
          Your photo is processed securely and never stored.<br />
          <button className="underline hover:text-white/70 transition-colors mt-1">
            Learn about accessibility
          </button>
        </p>
      </motion.div>
    </div>
  );
}