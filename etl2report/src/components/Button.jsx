import React from 'react';

const Button = ({ 
  displayText, 
  onClick, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    secondary: 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary border border-theme-primary focus:ring-blue-500',
    ghost: 'text-theme-primary hover:bg-theme-secondary focus:ring-blue-500'
  };
  
  const sizeClasses = {
    small: 'px-4 py-2 text-sm',
    medium: 'px-6 py-3 text-sm',
    large: 'px-8 py-4 text-base'
  };
  
  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : '';
  
  const loadingClasses = loading 
    ? 'opacity-75 cursor-wait' 
    : '';

  const combinedClasses = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.medium}
    ${disabledClasses}
    ${loadingClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={combinedClasses}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {displayText}
        </div>
      ) : (
        displayText
      )}
    </button>
  );
};

export default Button;