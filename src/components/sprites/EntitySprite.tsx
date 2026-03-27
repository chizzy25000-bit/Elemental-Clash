import { motion } from 'motion/react';

interface SpriteProps {
  type: 'player' | 'void_creature' | 'alchemist_bot' | 'boss';
  color: string;
  size: number;
  isMoving?: boolean;
}

export const EntitySprite = ({ type, color, size, isMoving }: SpriteProps) => {
  const bounceAnimation = isMoving ? {
    y: [0, -size * 0.1, 0],
    transition: {
      duration: 0.4,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  } : {};

  if (type === 'player') {
    return (
      <motion.svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        animate={bounceAnimation}
      >
        <rect x="20" y="20" width="60" height="60" rx="10" fill={color} stroke="#fff" strokeWidth="4" />
        <circle cx="35" cy="40" r="5" fill="#fff" />
        <circle cx="65" cy="40" r="5" fill="#fff" />
        <path d="M 35 65 Q 50 75 65 65" stroke="#fff" strokeWidth="4" fill="none" />
      </motion.svg>
    );
  }

  if (type === 'void_creature') {
    return (
      <motion.svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
          transition: { duration: 2, repeat: Infinity }
        }}
      >
        <path d="M 50 10 L 90 50 L 50 90 L 10 50 Z" fill={color} stroke="#000" strokeWidth="2" />
        <circle cx="50" cy="50" r="15" fill="#000" />
        <circle cx="50" cy="50" r="5" fill="#ff00ff" />
      </motion.svg>
    );
  }

  if (type === 'alchemist_bot') {
    return (
      <motion.svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100"
        animate={bounceAnimation}
      >
        <rect x="15" y="15" width="70" height="70" rx="4" fill={color} stroke="#333" strokeWidth="4" />
        <rect x="25" y="30" width="50" height="20" fill="#333" />
        <circle cx="40" cy="40" r="4" fill="#00ffff" />
        <circle cx="60" cy="40" r="4" fill="#00ffff" />
        <rect x="30" y="60" width="40" height="10" fill="#333" />
      </motion.svg>
    );
  }

  if (type === 'boss') {
    return (
      <motion.svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100"
        animate={{
          filter: ["drop-shadow(0 0 10px rgba(255,0,0,0.5))", "drop-shadow(0 0 20px rgba(255,0,0,0.8))", "drop-shadow(0 0 10px rgba(255,0,0,0.5))"],
          transition: { duration: 1, repeat: Infinity }
        }}
      >
        <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill={color} stroke="#000" strokeWidth="6" />
        <path d="M 30 30 L 70 30 L 50 70 Z" fill="#000" />
        <circle cx="50" cy="40" r="10" fill="#ff0000" />
        <path d="M 20 80 Q 50 60 80 80" stroke="#000" strokeWidth="4" fill="none" />
      </motion.svg>
    );
  }

  return null;
};
