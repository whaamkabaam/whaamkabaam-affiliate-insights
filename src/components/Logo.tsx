
import React from 'react';

export const Logo: React.FC<{ size?: "small" | "medium" | "large" }> = ({ size = "medium" }) => {
  const sizeClasses = {
    small: "w-10 h-10",
    medium: "w-16 h-16",
    large: "w-24 h-24",
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Flame logo with animation effect */}
      <div className={`${sizeClasses[size]} relative flame-animation`}>
        <img 
          src="/lovable-uploads/981998d1-5666-4294-9889-7a3d5a056bf2.png" 
          alt="WhaamKabaam Logo" 
          className={`${sizeClasses[size]} object-contain animate-flame`}
        />
      </div>
    </div>
  );
};
