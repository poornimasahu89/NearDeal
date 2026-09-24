import React from 'react';
import './Card.css';

export const Card = ({
  children,
  className = '',
  hoverEffect = false,
  padding = 'md', // 'none' | 'sm' | 'md' | 'lg'
  onClick,
  ...props
}) => {
  return (
    <div
      className={`card card-p-${padding} ${hoverEffect ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};
