import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { Shield, RotateCw, CircleCheck } from 'lucide-react';

type ChallengeType = 'turn-right' | 'turn-left' | 'follow-dot' | 'smile';
type ChallengeState = 'active' | 'success' | 'timeout';

interface Challenge {
  type: ChallengeType;
  instruction: string;
  duration: number; // in seconds
}

const challenges: Challenge[] = [
  {
    type: 'turn-right',
    instruction: 'Turn your head slightly to the right',
    duration: 5
  },
  {
    type: 'turn-left',
    instruction: 'Turn your head slightly to the left',
    duration: 5
  },
  {
    type: 'follow-dot',
    instruction: 'Follow the moving dot with your eyes',
    duration: 6
  },
  {
    type: 'smile',
    instruction: 'Smile naturally',
    duration: 4
  }
];

export default function MicroChallengeScreen() {
  const { primaryColor } = useTheme();
  const [currentChallenge, setCurrentChallenge] = useState<Challenge>(challenges[2]); // Start with follow-dot
  const [challengeState, setChallengeState] = useState<ChallengeState>('active');
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(currentChallenge.duration);
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 });

  // Reset when challenge changes
  useEffect(() => {
    setProgress(0);
    setTimeRemaining(currentChallenge.duration);
    setChallengeState('active');
  }, [currentChallenge]);

  // Progress simulation
  useEffect(() => {
    if (challengeState !== 'active') return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const increment = 100 / (currentChallenge.duration * 10);
        const newProgress = Math.min(prev + increment, 100);
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setChallengeState('success');
          // Move to next screen after success
          setTimeout(() => {
            console.log('Challenge complete - moving to next screen');
          }, 1500);
        }
        
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [challengeState, currentChallenge]);

  // Countdown timer
  useEffect(() => {
    if (challengeState !== 'active') return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          setChallengeState('timeout');
        }
        return Math.max(newTime, 0);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [challengeState]);

  // Animate dot for follow-dot challenge
  useEffect(() => {
    if (currentChallenge.type !== 'follow-dot' || challengeState !== 'active') return;

    const positions = [
      { x: 30, y: 30 },
      { x: 70, y: 30 },
      { x: 70, y: 70 },
      { x: 30, y: 70 },
      { x: 50, y: 50 }
    ];

    let currentIndex = 0;
    setDotPosition(positions[0]);

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % positions.length;
      setDotPosition(positions[currentIndex]);
    }, 1500);

    return () => clearInterval(interval);
  }, [currentChallenge.type, challengeState]);

  const handleRetry = () => {
    // Could cycle to a different challenge on retry
    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    setCurrentChallenge(randomChallenge);
  };

  const renderChallengeVisual = () => {
    switch (currentChallenge.type) {
      case 'turn-right':
        return (
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: [0, 20, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute right-8 top-1/2 -translate-y-1/2"
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}30` }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M9 18l6-6-6-6" 
                  stroke={primaryColor} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
        );

      case 'turn-left':
        return (
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: [0, -20, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-8 top-1/2 -translate-y-1/2"
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}30` }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M15 18l-6-6 6-6" 
                  stroke={primaryColor} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
        );

      case 'follow-dot':
        return (
          <motion.div
            className="absolute"
            animate={{
              left: `${dotPosition.x}%`,
              top: `${dotPosition.y}%`,
            }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            style={{ marginLeft: '-20px', marginTop: '-20px' }}
          >
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-10 h-10 rounded-full"
              style={{ backgroundColor: primaryColor, boxShadow: `0 0 20px ${primaryColor}80` }}
            />
          </motion.div>
        );

      case 'smile':
        return (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2"
          >
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <motion.svg 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <circle cx="12" cy="12" r="10" stroke={primaryColor} strokeWidth="2" />
                <circle cx="9" cy="9" r="1.5" fill={primaryColor} />
                <circle cx="15" cy="9" r="1.5" fill={primaryColor} />
                <path 
                  d="M8 14s1.5 2 4 2 4-2 4-2" 
                  stroke={primaryColor} 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </motion.svg>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

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
        </div>
      </div>

      {/* Camera Preview Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Simulated camera feed */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900">
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
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.5) 100%)'
          }}
        />

        <AnimatePresence mode="wait">
          {/* Active Challenge State */}
          {challengeState === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* Challenge Visual */}
              {renderChallengeVisual()}

              {/* Instruction */}
              <div className="absolute top-24 left-0 right-0 text-center px-6 z-20">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-black/40 backdrop-blur-md rounded-2xl px-6 py-4 mx-auto max-w-sm"
                >
                  <h2 className="text-white text-xl mb-2">{currentChallenge.instruction}</h2>
                  <p className="text-white/60 text-sm">Stay within the frame</p>
                </motion.div>
              </div>

              {/* Progress Bar */}
              <div className="absolute bottom-24 left-6 right-6 z-20">
                <div className="bg-white/10 backdrop-blur-sm rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: primaryColor }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                
                {/* Timer */}
                <motion.div 
                  className="text-center mt-3"
                  animate={{ opacity: timeRemaining <= 2 ? [1, 0.5, 1] : 1 }}
                  transition={{ duration: 0.5, repeat: timeRemaining <= 2 ? Infinity : 0 }}
                >
                  <span className="text-white/60 text-sm">
                    {timeRemaining}s remaining
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Success State */}
          {challengeState === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="relative z-20"
            >
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#10b98120' }}
              >
                <CircleCheck 
                  size={64} 
                  className="text-emerald-500"
                  strokeWidth={2}
                />
              </div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white text-xl mt-4 text-center"
              >
                Perfect!
              </motion.p>
            </motion.div>
          )}

          {/* Timeout State */}
          {challengeState === 'timeout' && (
            <motion.div
              key="timeout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative z-20 text-center px-6 max-w-sm"
            >
              <div className="bg-black/60 backdrop-blur-md rounded-3xl p-8">
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ backgroundColor: '#f59e0b20' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2" />
                    <path d="M12 8v4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="#f59e0b" />
                  </svg>
                </div>

                <h2 className="text-white text-2xl mb-3">Let's try that again</h2>
                <p className="text-white/70 text-sm leading-relaxed mb-6">
                  No worries! Take your time and make sure you're in a well-lit area.
                </p>

                <button
                  onClick={handleRetry}
                  className="w-full h-14 rounded-xl text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <RotateCw size={20} />
                  Try again
                </button>

                <button
                  onClick={() => console.log('Skip to manual verification')}
                  className="w-full h-12 text-white/60 text-sm mt-3 hover:text-white/80 transition-colors"
                >
                  Try another way
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Help text */}
      {challengeState === 'active' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pb-6 px-6 text-center z-20"
        >
          <p className="text-white/40 text-xs">
            This quick check helps us confirm you're present
          </p>
        </motion.div>
      )}
    </div>
  );
}