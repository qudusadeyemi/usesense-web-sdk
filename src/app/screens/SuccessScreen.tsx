import { motion } from 'motion/react';
import { CircleCheck, Shield, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SuccessScreen() {
  const { primaryColor } = useTheme();

  const handleComplete = () => {
    // In a real SDK, this would close the verification flow
    // and return success to the parent app
    console.log('Verification complete');
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
        {/* Success animation with concentric circles */}
        <div className="relative">
          {/* Outer expanding ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: `${primaryColor}15` }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.4, 1.4],
              opacity: [0.6, 0.2, 0]
            }}
            transition={{ 
              duration: 1.5,
              ease: 'easeOut'
            }}
          />
          
          {/* Middle ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: `${primaryColor}25` }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.2, 1.2],
              opacity: [0.8, 0.3, 0]
            }}
            transition={{ 
              duration: 1.2,
              ease: 'easeOut',
              delay: 0.1
            }}
          />

          {/* Background circle */}
          <motion.div
            className="relative w-32 h-32 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}10` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.1 
            }}
          >
            {/* Checkmark icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: 0.3
              }}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Check 
                  size={48} 
                  className="text-white"
                  strokeWidth={3}
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
          <h1 className="text-3xl mb-3 text-gray-900">You're verified</h1>
          <p className="text-gray-600 text-base">
            Thank you.
          </p>
        </motion.div>

        {/* Optional: Subtle success indicators */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="mt-8 flex items-center gap-2 text-sm text-gray-500"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-emerald-500"
          />
          <span>Identity confirmed</span>
        </motion.div>
      </div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        onClick={handleComplete}
        className="w-full max-w-sm h-14 rounded-xl text-white transition-all active:scale-[0.98] shadow-lg"
        style={{ backgroundColor: primaryColor }}
      >
        Continue
      </motion.button>
    </div>
  );
}