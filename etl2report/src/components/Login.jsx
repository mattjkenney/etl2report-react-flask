import React, { useState } from 'react';
import Button from './Button';

const Login = ({ onLogin, onSignup, className = '' }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call the onLogin prop if provided
      if (onLogin) {
        await onLogin(formData);
      } else {
        // Default behavior - just log the form data
        console.log('Login attempt:', formData);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert('Login successful! (This is just a demo)');
      }
    } catch (error) {
      setErrors({ general: error.message || 'Login failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupClick = (e) => {
    e.preventDefault();
    if (onSignup) {
      onSignup();
    } else {
      // Default behavior - just show an alert for demo
      alert('Signup functionality would be implemented here');
    }
  };

  return (
    <div className={`bg-theme-secondary p-6 rounded-lg border border-theme-primary shadow-theme-lg ${className}`}>
      <h2 className="text-2xl font-bold text-theme-primary mb-6 text-center">Login</h2>
      
      {errors.general && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
          {errors.general}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col">
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-theme-secondary mb-2 self-start"
          >
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className={`
              w-full px-3 py-2 
              bg-theme-primary 
              border ${errors.username ? 'border-red-500' : 'border-theme-primary'}
              rounded-md 
              text-theme-primary
              placeholder-theme-muted
              focus:outline-none 
              focus:ring-2 
              focus:ring-blue-500 
              focus:border-transparent
              transition-colors
            `}
            placeholder="Enter your username"
            disabled={isLoading}
          />
          {errors.username && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
          )}
        </div>

        <div className="flex flex-col">
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-theme-secondary mb-2 self-start"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`
              w-full px-3 py-2 
              bg-theme-primary 
              border ${errors.password ? 'border-red-500' : 'border-theme-primary'}
              rounded-md 
              text-theme-primary
              placeholder-theme-muted
              focus:outline-none 
              focus:ring-2 
              focus:ring-blue-500 
              focus:border-transparent
              transition-colors
            `}
            placeholder="Enter your password"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
          )}
        </div>

        <Button
          type="submit"
          displayText={isLoading ? 'Logging in...' : 'Login'}
          loading={isLoading}
          disabled={isLoading}
          variant="primary"
          className="w-full"
        />
      </form>

      <div className="mt-6 space-y-3 text-center">
        <a 
          href="#" 
          className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Forgot your password?
        </a>
        
        <div className="flex items-center justify-center">
          <span className="text-sm text-theme-secondary">Don't have an account?&nbsp;</span>
          <button
            onClick={handleSignupClick}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none"
          >
            Sign up here
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;