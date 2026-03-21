import { motion } from 'motion/react';
import { Info, Shield, MessageCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function BlockedScreen() {
  const { primaryColor } = useTheme();

  const handleContactSupport = () => {
    console.log('Contact support');
    // In a real SDK, this would open support contact options
  };

  const handleClose = () => {
    console.log('Close verification flow');
    // In a real SDK, this would close the SDK modal/flow
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
        {/* Info icon with calm animation */}
        <div className="relative">
          {/* Subtle background pulse */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gray-200"
            animate={{ 
              scale: [1, 1.08, 1],
              opacity: [0.3, 0.15, 0.3]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Main icon container */}
          <motion.div
            className="relative w-32 h-32 rounded-full flex items-center justify-center bg-gray-100"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 160,
              damping: 18,
              delay: 0.1 
            }}
          >
            {/* Info icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: 'spring',
                stiffness: 180,
                damping: 16,
                delay: 0.3
              }}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-600"
              >
                <Info 
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
          <h1 className="text-3xl mb-3 text-gray-900">Verification unavailable</h1>
          <p className="text-gray-600 text-base leading-relaxed">
            Please contact support.
          </p>
        </motion.div>

        {/* Support info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="mt-8 bg-gray-50 rounded-xl p-5 w-full border border-gray-100"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-gray-200">
              <MessageCircle size={20} className="text-gray-600" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 text-sm font-medium mb-1">
                Our team is here to help
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                We'll help you complete verification through another method.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-sm space-y-3">
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          onClick={handleContactSupport}
          className="w-full h-14 rounded-xl text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <MessageCircle size={20} strokeWidth={2.5} />
          Contact support
        </motion.button>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          onClick={handleClose}
          className="w-full h-12 rounded-xl text-gray-600 transition-all active:scale-[0.98] bg-transparent hover:bg-gray-50"
        >
          Close
        </motion.button>
      </div>
    </div>
  );
}
