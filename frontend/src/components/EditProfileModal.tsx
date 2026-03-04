import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, isLoaded } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    imageUrl: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user && isLoaded) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        imageUrl: user.imageUrl || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setProfileError(null);
      setPasswordError(null);
      setSuccess(false);
    }
  }, [user, isLoaded, isOpen]);

  const parseClerkError = (error: unknown): string => {
    if (typeof error === 'object' && error !== null && 'errors' in error) {
      const details = (error as { errors?: Array<{ message?: string; longMessage?: string }> }).errors;
      if (details?.length) {
        return details[0].longMessage || details[0].message || 'Request failed';
      }
    }

    return error instanceof Error ? error.message : 'Request failed';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setProfileError('User not found');
      return;
    }

    const wantsPasswordUpdate = Boolean(formData.newPassword.trim());
    if (wantsPasswordUpdate) {
      if (formData.newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters long.');
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setPasswordError('New password and confirm password do not match.');
        return;
      }

      if (user.passwordEnabled && !formData.currentPassword) {
        setPasswordError('Current password is required to change your password.');
        return;
      }
    }

    setIsSaving(true);
    setProfileError(null);
    setPasswordError(null);
    setSuccess(false);

    try {
      // Check if username changed
      const usernameChanged = formData.username.trim() !== user.username;
      
      // Build update payload - only include username if it changed
      const updatePayload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        unsafeMetadata: {
          ...user.unsafeMetadata,
          customImageUrl: formData.imageUrl,
        },
      };

      // Only add username if it changed (username updates require verification)
      if (usernameChanged && formData.username.trim()) {
        updatePayload.username = formData.username.trim();
      }

      await user.update(updatePayload);

      if (wantsPasswordUpdate) {
        await user.updatePassword({
          newPassword: formData.newPassword,
          currentPassword: user.passwordEnabled ? formData.currentPassword : undefined,
          signOutOfOtherSessions: false,
        });
      }
      
      setSuccess(true);
      setFormData((previous) => ({
        ...previous,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      const message = parseClerkError(err);
      
      // Check if it's a verification error specifically for username
      if (message.includes('verification') || message.includes('additional')) {
        setProfileError('Username change requires additional verification. Please ensure your email is verified in your Clerk account settings, or try again after re-logging in.');
      } else if (wantsPasswordUpdate) {
        setPasswordError(message);
      } else {
        setProfileError(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-5xl rounded-3xl bg-white dark:bg-slate-800 shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 md:px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Profile</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Manage account details and password</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-4 md:px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <section className="rounded-2xl border border-slate-200/90 bg-slate-50/60 dark:bg-slate-900/30 dark:border-slate-700/80 p-3 space-y-2.5">
              <div className="mb-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Profile Details</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Update your public information</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="username" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Username"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                  {formData.username !== user?.username && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Changing username requires account verification
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="imageUrl" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Image URL <span className="text-[10px] text-slate-400">optional</span>
                  </label>
                  <input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-slate-50/60 dark:bg-slate-900/30 dark:border-slate-700/80 p-3 space-y-2.5">
              <div className="mb-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Change Password</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Leave empty if you do not want to update</p>
              </div>

              {user?.passwordEnabled ? (
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    placeholder="Enter current password"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400">No password set yet. Create one below.</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="newPassword" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    placeholder="New password"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    disabled={isSaving}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Profile Error Message */}
          {profileError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{profileError}</p>
            </div>
          )}

          {/* Password Error Message */}
          {passwordError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{passwordError}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Profile updated successfully!</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2.5 border-t border-slate-200 dark:border-slate-700 pt-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m5.9 5.9l2.83 2.83M4.22 19.78l2.83-2.83m5.9-5.9l2.83-2.83M2 12h4m12 0h4" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 200ms ease-out;
        }

        .animate-slideUp {
          animation: slideUp 300ms ease-out;
        }
      `}</style>
    </div>
  );
};
