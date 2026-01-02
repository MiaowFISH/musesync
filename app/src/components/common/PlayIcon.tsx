// app/src/components/common/PlayIcon.tsx
// Play/Pause icon component using Expo vector icons

import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface PlayIconProps {
  isPlaying: boolean;
  size?: number;
  color?: string;
}

export const PlayIcon: React.FC<PlayIconProps> = ({ 
  isPlaying, 
  size = 28, 
  color = '#FFFFFF' 
}) => {
  return (
    <Ionicons 
      name={isPlaying ? 'pause' : 'play'} 
      size={size} 
      color={color}
      style={{ marginLeft: isPlaying ? 0 : 3 }} // Slight offset for play icon to appear centered
    />
  );
};
