import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function IntroScreen() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();

  const handleContinue = () => {
    navigate('/ui-preview/camera-request');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 pb-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mb-8"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <Shield 
              size={32} 
              style={{ color: primaryColor }}
              strokeWidth={2}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-2xl mb-3">Quick verification</h1>
          <p className="text-muted-foreground leading-relaxed">
            We'll take a quick look to make sure it's really you. This keeps your account safe.
          </p>
        </motion.div>
      </div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        onClick={handleContinue}
        className="w-full max-w-sm h-14 rounded-xl text-white transition-all active:scale-[0.98]"
        style={{ backgroundColor: primaryColor }}
      >
        Continue
      </motion.button>
    </div>
  );
}