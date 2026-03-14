import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { FormErrorMessage } from './ui/FormErrorMessage';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, isLoaded } = useUser();
  const AUTO_CLOSE_MS = 4000;
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessages, setSuccessMessages] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  
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
    if (!isOpen || !user || !isLoaded) return;

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
    setSuccessMessages([]);
    setShowSuccess(false);
  }, [isOpen, isLoaded, user?.id]);

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
    setSuccessMessages([]);
    setShowSuccess(false);

    try {
      // Track which fields changed for success messages
      const changedFields: string[] = [];
      
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

      // Track profile field changes - compare trimmed values
      if (formData.firstName.trim() !== (user.firstName || '').trim()) changedFields.push('First name');
      if (formData.lastName.trim() !== (user.lastName || '').trim()) changedFields.push('Last name');
      if (usernameChanged && formData.username.trim()) changedFields.push('Username');
      const currentImageUrl = ((user.unsafeMetadata?.customImageUrl as string) || user.imageUrl || '').trim();
      if (formData.imageUrl.trim() !== currentImageUrl) changedFields.push('Profile image');

      await user.update(updatePayload);
      
      // If no specific fields detected as changed, add generic profile success message
      if (!changedFields.length) {
        changedFields.push('Profile');
      }

      // Handle password update separately so profile success isn't blocked
      if (wantsPasswordUpdate) {
        try {
          await user.updatePassword({
            newPassword: formData.newPassword,
            currentPassword: user.passwordEnabled ? formData.currentPassword : undefined,
            signOutOfOtherSessions: false,
          });
          changedFields.push('Password');
        } catch (pwdErr) {
          setPasswordError(parseClerkError(pwdErr));
        }
      }
      
      // Set success messages for all changed fields
      if (changedFields.length > 0) {
        setSuccessMessages(changedFields.map(field => `${field} successfully updated!`));
        setShowSuccess(true);
      }
      
      setFormData((previous) => ({
        ...previous,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        setSuccessMessages([]);
      }, AUTO_CLOSE_MS);
    } catch (err) {
      const message = parseClerkError(err);
      
      // Check if it's a verification error specifically for username
      if (message.includes('verification') || message.includes('additional')) {
        setProfileError('Username change requires additional verification. Please ensure your email is verified in your Clerk account settings, or try again after re-logging in.');
      } else {
        setProfileError(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen && !showSuccess) return null;

  return (
    <>
      {/* Modal */}
      {isOpen && (
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
            aria-label="Close edit profile modal"
          >
            <X size={24} aria-hidden="true" />
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
                      <AlertTriangle size={12} aria-hidden="true" />
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
          <FormErrorMessage message={profileError || ''} />

          {/* Password Error Message */}
          <FormErrorMessage message={passwordError || ''} />

          {/* Success Messages - Large Prominent Alert */}
          {showSuccess && successMessages.length > 0 && (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-600 px-6 py-4 animate-slideDown">
              <div className="space-y-3">
                {successMessages.map((msg, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 size={24} className="flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                    <span className="text-lg font-bold text-green-700 dark:text-green-300">{msg}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-green-200/70 dark:bg-green-800/60">
                <div
                  className="h-full w-full origin-left rounded-full bg-green-500/80 dark:bg-green-400/80 animate-successProgress"
                  style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
                />
              </div>
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
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
        </div>
      )}

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

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes successProgress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 200ms ease-out;
        }

        .animate-slideUp {
          animation: slideUp 300ms ease-out;
        }

        .animate-slideDown {
          animation: slideDown 300ms ease-out;
        }

        .animate-successProgress {
          animation-name: successProgress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </>
  );
};
