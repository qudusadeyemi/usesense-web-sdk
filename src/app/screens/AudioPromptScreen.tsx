import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { Shield, Mic, MicOff, RotateCw, CircleCheck, Volume2 } from 'lucide-react';

type AudioState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

const samplePhrases = [
  "The sky is blue today",
  "I confirm this is me",
  "Sunshine and fresh air",
  "Hello, this is my voice",
  "I verify my identity",
  "Today is a great day",
  "Verify my presence now"
];

export default function AudioPromptScreen() {
  const { primaryColor } = useTheme();
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [currentPhrase, setCurrentPhrase] = useState(samplePhrases[0]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState(true); // Simulate permission granted

  // Generate random phrase on mount
  useEffect(() => {
    const randomPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
    setCurrentPhrase(randomPhrase);
  }, []);

  // Simulate audio level detection when listening
  useEffect(() => {
    if (audioState !== 'listening') {
      setAudioLevel(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate audio levels with some randomness
      const baseLevel = Math.sin(Date.now() / 200) * 0.3 + 0.5;
      const randomVariation = Math.random() * 0.3;
      setAudioLevel(Math.min(baseLevel + randomVariation, 1));
    }, 50);

    return () => clearInterval(interval);
  }, [audioState]);

  // Progress tracking during listening
  useEffect(() => {
    if (audioState !== 'listening') {
      setProgress(0);
      return;
    }

    const duration = 4000; // 4 seconds to complete
    const interval = 100;
    const increment = (interval / duration) * 100;

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          setAudioState('processing');
          
          // Simulate processing then success
          setTimeout(() => {
            setAudioState('success');
            setTimeout(() => {
              console.log('Audio verification complete - moving to next screen');
            }, 1500);
          }, 1200);
          
          return 100;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(progressInterval);
  }, [audioState]);

  const handleStartListening = () => {
    setAudioState('listening');
  };

  const handleRetry = () => {
    // Generate new phrase
    const randomPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
    setCurrentPhrase(randomPhrase);
    setAudioState('idle');
    setProgress(0);
  };

  const renderAudioVisualization = () => {
    const bars = 5;
    return (
      <div className="flex items-center justify-center gap-1.5 h-12">
        {Array.from({ length: bars }).map((_, i) => {
          const delay = i * 0.1;
          const heightMultiplier = audioState === 'listening' 
            ? audioLevel * (0.5 + Math.sin(Date.now() / 200 + i) * 0.5)
            : 0;
          
          return (
            <motion.div
              key={i}
              className="w-1.5 rounded-full"
              style={{ backgroundColor: primaryColor }}
              animate={{
                height: audioState === 'listening' 
                  ? `${20 + heightMultiplier * 30}px`
                  : '8px',
                opacity: audioState === 'listening' ? [0.4, 1, 0.4] : 0.3
              }}
              transition={{
                height: { duration: 0.15 },
                opacity: { duration: 1, repeat: Infinity, delay }
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="pt-6 px-6 z-20">
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

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <AnimatePresence mode="wait">
          {/* Idle/Listening/Processing State */}
          {(audioState === 'idle' || audioState === 'listening' || audioState === 'processing') && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center"
            >
              {/* Title */}
              <motion.h1 
                className="text-white text-2xl mb-8"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Say the phrase below
              </motion.h1>

              {/* Phrase Card */}
              <motion.div
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 mb-10 border border-white/10"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Volume2 
                  size={24} 
                  className="text-white/40 mx-auto mb-4"
                />
                <p className="text-white text-xl leading-relaxed">
                  "{currentPhrase}"
                </p>
              </motion.div>

              {/* Microphone Indicator */}
              <motion.div
                className="mb-8"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <div className="relative inline-block">
                  {/* Pulsing ring when listening */}
                  {audioState === 'listening' && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: primaryColor }}
                        animate={{
                          scale: [1, 1.4, 1.4],
                          opacity: [0.5, 0, 0]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeOut'
                        }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: primaryColor }}
                        animate={{
                          scale: [1, 1.4, 1.4],
                          opacity: [0.5, 0, 0]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeOut',
                          delay: 0.4
                        }}
                      />
                    </>
                  )}

                  {/* Main button */}
                  <button
                    onClick={audioState === 'idle' ? handleStartListening : undefined}
                    disabled={audioState !== 'idle'}
                    className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:active:scale-100"
                    style={{ 
                      backgroundColor: audioState === 'listening' ? primaryColor : `${primaryColor}30`,
                      cursor: audioState === 'idle' ? 'pointer' : 'default'
                    }}
                  >
                    {hasPermission ? (
                      <Mic 
                        size={40} 
                        className="text-white"
                        strokeWidth={2}
                      />
                    ) : (
                      <MicOff 
                        size={40} 
                        className="text-white/60"
                        strokeWidth={2}
                      />
                    )}
                  </button>

                  {/* Processing spinner */}
                  {audioState === 'processing' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-white/20"
                      style={{ borderTopColor: 'white' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              </motion.div>

              {/* Audio Visualization */}
              <div className="mb-6 h-12">
                {renderAudioVisualization()}
              </div>

              {/* Status Text */}
              <motion.div
                key={audioState}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                {audioState === 'idle' && (
                  <p className="text-white/60 text-sm">
                    Tap the microphone to begin
                  </p>
                )}
                {audioState === 'listening' && (
                  <div className="space-y-2">
                    <p className="text-white text-sm font-medium">
                      Listening...
                    </p>
                    {/* Progress bar */}
                    <div className="w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: primaryColor }}
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {audioState === 'processing' && (
                  <p className="text-white/60 text-sm">
                    Processing...
                  </p>
                )}
              </motion.div>

              {/* Retry button (only show when idle) */}
              {audioState === 'idle' && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={handleRetry}
                  className="text-white/50 text-sm flex items-center gap-2 mx-auto hover:text-white/70 transition-colors"
                >
                  <RotateCw size={16} />
                  Try a different phrase
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Success State */}
          {audioState === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-center"
            >
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
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
                className="text-white text-xl"
              >
                Voice verified!
              </motion.p>
            </motion.div>
          )}

          {/* Error State */}
          {audioState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm text-center"
            >
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: '#f59e0b20' }}
              >
                <MicOff size={32} className="text-amber-500" />
              </div>

              <h2 className="text-white text-2xl mb-3">Couldn't hear you</h2>
              <p className="text-white/70 text-sm leading-relaxed mb-8">
                Make sure you're in a quiet place and speak clearly.
              </p>

              <button
                onClick={handleRetry}
                className="w-full h-14 rounded-xl text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <RotateCw size={20} />
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Privacy Reassurance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pb-8 px-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          <p>Your audio is not stored.</p>
        </div>
      </motion.div>
    </div>
  );
}