import { motion } from 'motion/react';
import { CircleAlert, RotateCw, Shield, MessageCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function FailureScreen() {
  const { primaryColor } = useTheme();

  const handleRetry = () => {
    console.log('Retry verification');
    // In a real SDK, this would restart the verification flow
  };

  const handleContactSupport = () => {
    console.log('Contact support');
    // In a real SDK, this would open support options
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-between p-6 pb-8">
      {/* Header with branding */}
      <div className="w-full max-w-sm pt-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-2"
        >
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
          <span className="text-gray-900 font-semibold">UseSense</span>
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        {/* Warning icon with subtle animation */}
        <div className="relative">
          {/* Background pulse */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: '#f59e0b15' }}
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.5, 0.2, 0.5]
            }}
            transition={{ 
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Main icon container */}
          <motion.div
            className="relative w-32 h-32 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#fef3c7' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 180,
              damping: 15,
              delay: 0.1 
            }}
          >
            {/* Warning icon */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 18,
                delay: 0.3
              }}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#f59e0b' }}
              >
                <CircleAlert 
                  size={48} 
                  className="text-white"
                  strokeWidth={2.5}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center mt-12"
        >
          <h1 className="text-3xl mb-3 text-gray-900">We couldn't verify you</h1>
          <p className="text-gray-600 text-base leading-relaxed">
            Please try again in good lighting.
          </p>
        </motion.div>

        {/* Optional: Helpful tips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="mt-8 bg-gray-50 rounded-xl p-4 w-full border border-gray-100"
        >
          <p className="text-gray-600 text-sm text-center leading-relaxed">
            <strong className="text-gray-900">Helpful tips:</strong><br />
            Find a well-lit area and remove accessories that cover your face.
          </p>
        </motion.div>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-sm space-y-3">
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          onClick={handleRetry}
          className="w-full h-14 rounded-xl text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <RotateCw size={20} strokeWidth={2.5} />
          Try again
        </motion.button>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          onClick={handleContactSupport}
          className="w-full h-12 rounded-xl text-gray-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50"
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          Contact support
        </motion.button>
      </div>
    </div>
  );
}