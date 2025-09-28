import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Button from './Button';
import NewPasswordRequired from './NewPasswordRequired';
import PasswordInput from './PasswordInput';
import { 
    updateFormData, 
    setFormErrors, 
    validateLoginForm, 
    loginUser, 
    showSignup,
    clearGeneralError,
    setGeneralError,
    resetFormData
} from '../store/auth/index.js';
import { configureCognito } from '../config/cognito';

const Login = ({ className = '' }) => {
    const dispatch = useDispatch();
    const { formData, formErrors } = useSelector(state => state.auth.login);
    const { isLoading, isLoggedIn, error, requireNewPassword } = useSelector(state => state.auth.user);
    const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);

    // Initialize Cognito configuration
    useEffect(() => {
        configureCognito();
    }, []);

    // Handle user slice state changes
    useEffect(() => {
        if (isLoggedIn) {
            // Clear form data on successful login
            dispatch(resetFormData());
        }
    }, [isLoggedIn, dispatch]);

    useEffect(() => {
        if (error) {
            // Set general error from user slice
            dispatch(setGeneralError(error));
        }
    }, [error, dispatch]);

    useEffect(() => {
        if (requireNewPassword) {
            setShowNewPasswordForm(true);
        }
    }, [requireNewPassword]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        dispatch(updateFormData({ name, value }));
    };

    const validateForm = () => {
        const { errors, isValid } = validateLoginForm(formData);
        dispatch(setFormErrors(errors));
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        // Clear general error when starting new login attempt
        dispatch(clearGeneralError());
        
        // Dispatch loginUser action
        dispatch(loginUser(formData));
    };

    const handleSignupClick = (e) => {
        e.preventDefault();
        // Dispatch showSignup action directly
        dispatch(showSignup(true));
    };

    if (showNewPasswordForm) {
        return <NewPasswordRequired 
            username={formData.username}
            onSuccess={() => setShowNewPasswordForm(false)}
        />;
    }

    return (
        <div className={`bg-theme-secondary p-6 rounded-lg border border-theme-primary shadow-theme-lg ${className}`}>
            <h2 className="text-2xl font-bold text-theme-primary mb-6 text-center">Login</h2>

            {formErrors.general && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
                    {formErrors.general}
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
                            border ${formErrors.username ? 'border-red-500' : 'border-theme-primary'}
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
                    {formErrors.username && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formErrors.username}</p>
                    )}
                </div>

                <PasswordInput
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    error={formErrors.password}
                    label="Password"
                />

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