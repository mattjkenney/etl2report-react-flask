import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { confirmSignIn } from 'aws-amplify/auth';
import Button from './Button';
import PasswordInput from './PasswordInput';
import { loginSuccess, loginFailure } from '../store/auth/user.js';

const NewPasswordRequired = ({ username, onSuccess }) => {
    const dispatch = useDispatch();
    const { isLoading } = useSelector(state => state.auth.user);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const validateForm = () => {
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return false;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        try {
            const { isSignedIn, nextStep } = await confirmSignIn({
                challengeResponse: newPassword
            });

            if (isSignedIn) {
                dispatch(loginSuccess({ username }));
                if (onSuccess) {
                    onSuccess();
                }
            } else {
                setError(`Additional step required: ${nextStep?.signInStep}`);
            }
        } catch (error) {
            setError(error.message);
            dispatch(loginFailure(error.message));
        }
    };

    return (
        <div className="bg-theme-secondary p-6 rounded-lg border border-theme-primary shadow-theme-lg">
            <h2 className="text-2xl font-bold text-theme-primary mb-6 text-center">Change Password Required</h2>
            <p className="text-theme-secondary mb-4">
                You must change your password before continuing.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <PasswordInput
                    id="newPassword"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    disabled={isLoading}
                    required
                />

                <PasswordInput
                    id="confirmPassword"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    disabled={isLoading}
                    required
                />

                <Button
                    type="submit"
                    displayText={isLoading ? 'Updating...' : 'Update Password'}
                    loading={isLoading}
                    disabled={isLoading}
                    variant="primary"
                    className="w-full"
                />
            </form>
        </div>
    );
};

export default NewPasswordRequired;