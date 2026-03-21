import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';

export default function ProcessingScreen() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();

  useEffect(() => {
    // Simulate processing time
    const timer = setTimeout(() => {
      navigate('/ui-preview/success');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            {/* Outer spinning ring */}
            <motion.div
              className="w-24 h-24 rounded-full border-4 border-transparent"
              style={{ 
                borderTopColor: primaryColor,
                borderRightColor: `${primaryColor}40`
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
            
            {/* Inner pulse circle */}
            <motion.div
              className="absolute inset-0 m-auto w-16 h-16 rounded-full"
              style={{ backgroundColor: `${primaryColor}20` }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <h2 className="text-xl mb-2">Verifying...</h2>
          <p className="text-muted-foreground text-sm">
            This will only take a moment
          </p>
        </motion.div>
      </div>
    </div>
  );
}