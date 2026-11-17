import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  Mail,
  Key,
  Inbox,
  Building2,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  Hourglass,
  ArrowLeft
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { useArtOps } from '../../context/ArtOpsContext';
import { validateCompanyEmail } from '../../lib/authService';

interface OfficeLoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess?: (user: User) => void;
}

type AuthViewMode =
  | 'login'
  | 'register'
  | 'verify_code'
  | 'forgot_password'
  | 'reset_password'
  | 'request_sent_success'
  | 'waiting_approval'
  | 'rejected_notice';

export const OfficeLoginModal: React.FC<OfficeLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const {
    loginWithOfficeId,
    registerUserWithOfficeId,
    verifyUserWithCode,
    resendVerificationCode,
    checkUserStatus,
    requestPasswordReset,
    resetUserPassword,
    isAuthenticated,
    studioMails
  } = useArtOps();

  const [viewMode, setViewMode] = useState<AuthViewMode>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDepartment, setRegDepartment] = useState('Art Department');
  const [regTitle, setRegTitle] = useState('Concept Artist / Specialist');
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Active user in-flow (registered or pending)
  const [activeFlowUser, setActiveFlowUser] = useState<User | null>(null);

  // Verification code form state
  const [verifyIdentifier, setVerifyIdentifier] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Forgot & Reset Password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);

  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Resend code countdown timer
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Waiting screen status check state
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckMsg, setStatusCheckMsg] = useState<string | null>(null);

  // Resend timer countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your Company Work Email or Office ID.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsSubmittingLogin(true);
    try {
      const result = await loginWithOfficeId(loginIdentifier.trim(), loginPassword.trim() || undefined);
      if (result.success && result.user) {
        if (onLoginSuccess) onLoginSuccess(result.user);
        if (onClose) onClose();
      } else {
        if (result.status === 'PENDING_APPROVAL' && result.user) {
          setActiveFlowUser(result.user);
          setViewMode('waiting_approval');
        } else if (result.status === 'REJECTED' && result.user) {
          setActiveFlowUser(result.user);
          setViewMode('rejected_notice');
        } else {
          setLoginError(result.error || 'Invalid email/ID or password.');
        }
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login attempt failed.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Full Name is required.');
      return;
    }
    
    const emailCheck = validateCompanyEmail(regEmail);
    if (!emailCheck.valid) {
      setRegError(emailCheck.error || 'A valid company work email address is required.');
      return;
    }
    
    if (!regPassword.trim()) {
      setRegError('Please create a password for your account.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const result = await registerUserWithOfficeId({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        role: 'ARTIST',
        department: regDepartment.trim() || 'Art Department',
        title: regTitle.trim() || 'Studio Team Member'
      });

      if (result.success && result.user) {
        setActiveFlowUser(result.user);
        setVerifyIdentifier(result.user.email);
        setVerifyCode('');
        setVerifyError(null);
        setVerifySuccessMsg(null);
        setResendCooldown(45); // start 45s cooldown
        setViewMode('verify_code');
      } else {
        setRegError(result.error || 'Failed to submit registration request.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Registration failed.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Handle Verify Code Submit
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifySuccessMsg(null);

    if (!verifyIdentifier.trim()) {
      setVerifyError('Please enter your Company Email or Office ID.');
      return;
    }
    if (!verifyCode.trim() || verifyCode.trim().length !== 6) {
      setVerifyError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const result = await verifyUserWithCode(verifyIdentifier.trim(), verifyCode.trim());
      if (result.success && result.user) {
        setActiveFlowUser(result.user);

        // If user is already active (e.g. Admin or already approved), log in directly
        if (result.user.status === 'ACTIVE') {
          setVerifySuccessMsg(`Verification successful! Logged in as ${result.user.name}.`);
          setTimeout(() => {
            if (onLoginSuccess) onLoginSuccess(result.user!);
            if (onClose) onClose();
          }, 800);
        } else {
          // Transition immediately to "Request Sent to Admin" confirmation view
          setViewMode('request_sent_success');
        }
      } else {
        setVerifyError(result.error || 'Invalid 6-digit verification code. Please check your company email or click Resend Code.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Verification attempt failed.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Handle Resend Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    const targetIdentifier = verifyIdentifier.trim() || regEmail.trim();
    if (!targetIdentifier) {
      setVerifyError('Please enter your email to resend verification code.');
      return;
    }

    setIsResending(true);
    setVerifyError(null);
    setResendNotice(null);

    try {
      const res = await resendVerificationCode(targetIdentifier);
      if (res.success) {
        setResendNotice(`A fresh 6-digit verification code was dispatched to ${targetIdentifier} from ranjeet.patil@zapak.com.`);
        setResendCooldown(45);
      } else {
        setVerifyError(res.error || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Forgot Password Request Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const id = forgotIdentifier.trim();
    if (!id) {
      setForgotError('Please enter your Work Email address or Office ID.');
      return;
    }

    setIsSubmittingForgot(true);
    try {
      const res = await requestPasswordReset(id);
      if (res.success) {
        setVerifyIdentifier(res.email || id);
        setResetCodeInput('');
        setNewPassword('');
        setConfirmPassword('');
        setResetError(null);
        setResetSuccessMsg(null);
        setResendNotice(`A 6-digit recovery code was dispatched to ${res.email || id} from wwemayhemgame@gmail.com.`);
        setResendCooldown(45);
        setViewMode('reset_password');
      } else {
        setForgotError(res.error || 'Failed to locate account for password reset.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Password reset request failed.');
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  // Handle Reset Password Submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccessMsg(null);

    if (!verifyIdentifier.trim()) {
      setResetError('Email or Office ID is missing. Please start password reset again.');
      return;
    }

    if (!resetCodeInput.trim() || resetCodeInput.trim().length !== 6) {
      setResetError('Please enter the 6-digit security code sent to your email.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setResetError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await resetUserPassword(verifyIdentifier.trim(), resetCodeInput.trim(), newPassword.trim());
      if (res.success && res.user) {
        setResetSuccessMsg('🎉 Password has been successfully updated! You can now sign in.');
        setLoginIdentifier(verifyIdentifier.trim());
        setLoginPassword(newPassword.trim());
        setTimeout(() => {
          setViewMode('login');
          setLoginError(null);
          setResetSuccessMsg(null);
        }, 1200);
      } else {
        setResetError(res.error || 'Invalid 6-digit reset code or expired session.');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Handle Resend Reset Code
  const handleResendResetCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    const target = verifyIdentifier.trim() || forgotIdentifier.trim();
    if (!target) {
      setResetError('Please specify your email to resend code.');
      return;
    }

    setIsResending(true);
    setResetError(null);
    setResendNotice(null);

    try {
      const res = await requestPasswordReset(target);
      if (res.success) {
        setResendNotice(`A fresh 6-digit password reset code was dispatched to ${target} from wwemayhemgame@gmail.com.`);
        setResendCooldown(45);
      } else {
        setResetError(res.error || 'Failed to resend reset code.');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  // Handle Live Status Check in Waiting Screen
  const handleCheckStatus = async () => {
    const targetIdentifier = activeFlowUser?.email || loginIdentifier.trim();
    if (!targetIdentifier) return;

    setIsCheckingStatus(true);
    setStatusCheckMsg(null);

    try {
      const res = await checkUserStatus(targetIdentifier);
      if (res.success && res.user) {
        setActiveFlowUser(res.user);
        if (res.user.status === 'ACTIVE') {
          setStatusCheckMsg('Account approved by Administrator! Please sign in with your credentials.');
          setLoginIdentifier(res.user.email);
          setTimeout(() => {
            setViewMode('login');
          }, 1200);
        } else if (res.user.status === 'REJECTED') {
          setViewMode('rejected_notice');
        } else {
          setStatusCheckMsg('Your request is still in review by Studio Administrator. Please check back shortly.');
        }
      } else {
        setStatusCheckMsg(res.error || 'Could not verify status. Please try again.');
      }
    } catch (err: any) {
      setStatusCheckMsg('Error checking status. Please try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-office-login"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>RG ArtFlow</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Studio Portal
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Game Art Production & Operations Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onClose && isAuthenticated && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors text-xs font-semibold cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher (Visible on Login / Register / Verify screens) */}
        {(viewMode === 'login' || viewMode === 'register' || viewMode === 'verify_code') && (
          <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                setLoginError(null);
              }}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'login'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('register');
                setRegError(null);
              }}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'register'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus size={14} />
              <span>Create Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('verify_code');
                setVerifyError(null);
                setVerifySuccessMsg(null);
              }}
              className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'verify_code'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Key size={14} />
              <span>Verify Code</span>
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* ========================================================================= */}
          {/* 1. SIGN IN VIEW */}
          {/* ========================================================================= */}
          {viewMode === 'login' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Welcome Back</h3>
                <p className="text-xs text-slate-500">
                  Sign in with your registered corporate email ID or Office ID and password.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl border text-xs flex items-start gap-2.5 bg-rose-50 border-rose-200 text-rose-800 animate-in fade-in duration-150">
                  <AlertCircle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-bold">Sign In Error</p>
                    <p className="text-[11px] leading-snug">{loginError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Company Work Email or Office ID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={e => setLoginIdentifier(e.target.value)}
                        placeholder="e.g. wwemayhemgame@gmail.com or OFF-1001"
                        autoComplete="username"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden transition-all placeholder:text-slate-400"
                        required
                        autoFocus
                      />
                      <Mail size={15} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotIdentifier(loginIdentifier);
                          setForgotError(null);
                          setViewMode('forgot_password');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden transition-all placeholder:text-slate-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(prev => !prev)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  id="btn-submit-office-login"
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmittingLogin ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In to Studio</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="pt-3 flex items-center justify-between border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register');
                      setRegError(null);
                    }}
                    className="text-slate-600 hover:text-blue-600 font-medium cursor-pointer"
                  >
                    Don't have an account? <span className="font-bold text-blue-600 underline">Create one</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifyIdentifier(loginIdentifier);
                      setViewMode('verify_code');
                    }}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Key size={12} />
                    <span>Have code?</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. CREATE ACCOUNT VIEW */}
          {/* ========================================================================= */}
          {viewMode === 'register' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Create Studio Account</h3>
                <p className="text-xs text-slate-500">
                  Fill in your company details to receive a 6-digit verification code on your email.
                </p>
              </div>

              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden placeholder:text-slate-400"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Company Work Email ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="e.g. rahul.sharma@zapak.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden placeholder:text-slate-400"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    A 6-digit verification code will be sent to this email ID.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="Create a password for login"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 outline-hidden placeholder:text-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(prev => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Department</label>
                    <input
                      type="text"
                      value={regDepartment}
                      onChange={e => setRegDepartment(e.target.value)}
                      placeholder="e.g. 3D Art, UI/UX"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={regTitle}
                      onChange={e => setRegTitle(e.target.value)}
                      placeholder="e.g. 3D Character Artist"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Already have account? Sign In
                  </button>

                  <button
                    id="btn-submit-register-office"
                    type="submit"
                    disabled={isSubmittingReg}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmittingReg ? (
                      <span>Sending Code...</span>
                    ) : (
                      <>
                        <span>Continue & Send Code</span>
                        <Send size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. ENTER VERIFICATION CODE VIEW */}
          {/* ========================================================================= */}
          {viewMode === 'verify_code' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-950">
                <Mail size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-900">Verification Code Sent via Email</p>
                    <span className="text-[10px] font-semibold bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded-full">
                      Office Dispatch
                    </span>
                  </div>
                  <p className="text-blue-800 text-[11px] leading-relaxed">
                    A 6-digit security code has been dispatched to{' '}
                    <strong className="text-blue-950 underline font-mono">
                      {verifyIdentifier || regEmail || 'your email'}
                    </strong>
                    . Please check your company inbox and spam folder.
                  </p>
                  <p className="text-[10px] text-blue-700 font-medium pt-0.5">
                    Sender: <strong>Ranjeet Patil</strong> &lt;ranjeet.patil@zapak.com&gt;
                  </p>
                </div>
              </div>

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {resendNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{resendNotice}</span>
                </div>
              )}

              {verifySuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{verifySuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Work Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={verifyIdentifier}
                    onChange={e => setVerifyIdentifier(e.target.value)}
                    placeholder="e.g. name@zapak.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 outline-hidden placeholder:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    6-Digit Verification Code <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-2xl font-mono font-black tracking-widest text-slate-900 focus:bg-white focus:border-blue-600 outline-hidden placeholder:text-slate-300"
                      required
                      autoFocus
                    />
                    <Key size={18} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Resend Code Action */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 text-[11px]">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isResending}
                    className="font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                  >
                    {isResending ? (
                      <span>Sending...</span>
                    ) : resendCooldown > 0 ? (
                      <span>Resend in {resendCooldown}s</span>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>Resend Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft size={12} />
                    <span>Back to Sign In</span>
                  </button>

                  <button
                    id="btn-submit-verify-code"
                    type="submit"
                    disabled={isVerifyingCode}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isVerifyingCode ? (
                      <span>Verifying...</span>
                    ) : (
                      <>
                        <span>Verify & Submit Request</span>
                        <CheckCircle2 size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3B. FORGOT PASSWORD VIEW */}
          {/* ========================================================================= */}
          {viewMode === 'forgot_password' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Reset Your Password</h3>
                <p className="text-xs text-slate-500">
                  Enter your registered Work Email or Office ID. A 6-digit password recovery code will be dispatched to your email.
                </p>
              </div>

              {forgotError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Registered Work Email or Office ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={e => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. ranjeet.patil@zapak.com or OFF-1001"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden placeholder:text-slate-400"
                      required
                      autoFocus
                    />
                    <Mail size={15} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recovery code will be dispatched from <strong className="text-slate-700">Ranjeet Patil</strong> (<code>ranjeet.patil@zapak.com</code>).
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setForgotError(null);
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft size={12} />
                    <span>Back to Sign In</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingForgot}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmittingForgot ? (
                      <span>Searching & Dispatched...</span>
                    ) : (
                      <>
                        <span>Send Recovery Code</span>
                        <Send size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3C. RESET PASSWORD VIEW (ENTER CODE & NEW PASSWORD) */}
          {/* ========================================================================= */}
          {viewMode === 'reset_password' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3 text-xs text-purple-950">
                <Key size={18} className="text-purple-600 mt-0.5 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-purple-950">Password Recovery Code Sent</p>
                    <span className="text-[10px] font-semibold bg-purple-200/70 text-purple-800 px-2 py-0.5 rounded-full">
                      Security Reset
                    </span>
                  </div>
                  <p className="text-purple-900 text-[11px] leading-relaxed">
                    A 6-digit recovery code was dispatched to{' '}
                    <strong className="text-purple-950 underline font-mono">
                      {verifyIdentifier || forgotIdentifier}
                    </strong>
                    . Enter the code and choose your new password below.
                  </p>
                  <p className="text-[10px] text-purple-800 font-medium">
                    Sender: <strong>Ranjeet Patil</strong> &lt;ranjeet.patil@zapak.com&gt;
                  </p>
                </div>
              </div>

              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resendNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{resendNotice}</span>
                </div>
              )}

              {resetSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{resetSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    6-Digit Recovery Code <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={resetCodeInput}
                      onChange={e => setResetCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-xl font-mono font-black tracking-widest text-slate-900 focus:bg-white focus:border-purple-600 outline-hidden placeholder:text-slate-300"
                      required
                      autoFocus
                    />
                    <Key size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 4 characters"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-purple-600 outline-hidden placeholder:text-slate-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-purple-600 outline-hidden placeholder:text-slate-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resend Code Action */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 text-[11px]">Didn't get recovery code?</span>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resendCooldown > 0 || isResending}
                    className="font-bold text-purple-700 hover:text-purple-900 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                  >
                    {isResending ? (
                      <span>Sending...</span>
                    ) : resendCooldown > 0 ? (
                      <span>Resend in {resendCooldown}s</span>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>Resend Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewMode('login')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft size={12} />
                    <span>Back to Sign In</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingReset}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmittingReset ? (
                      <span>Resetting Password...</span>
                    ) : (
                      <>
                        <span>Reset Password & Sign In</span>
                        <CheckCircle2 size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. REQUEST SENT TO ADMIN (AFTER VERIFICATION) */}
          {/* ========================================================================= */}
          {viewMode === 'request_sent_success' && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <Send size={26} />
              </div>

              <div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider inline-block mb-2">
                  Request Dispatched to Admin
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Access Request Sent to Administrator
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your email has been verified. Your request has been forwarded to Studio Administrator{' '}
                  <strong className="text-slate-900">Ranjeet Patil</strong> (<code>ranjeet.patil@zapak.com</code>) for review.
                </p>
              </div>

              {/* Summary Card */}
              {activeFlowUser && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 text-left space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Applicant</span>
                    <span className="font-bold text-slate-900">{activeFlowUser.name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Work Email</span>
                    <span className="font-mono text-slate-900">{activeFlowUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Assigned Office ID</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeFlowUser.officeId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Status</span>
                    <span className="font-bold text-amber-600 flex items-center gap-1">
                      <Clock size={12} />
                      <span>Pending Admin Approval</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-left text-xs text-amber-950 space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-700" />
                  <span>What happens next?</span>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Next time you launch the app, sign in with your email and password. Once accepted by the Administrator, you will automatically enter your full accessible workspace!
                </p>
              </div>

              {statusCheckMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium animate-in fade-in">
                  {statusCheckMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={isCheckingStatus ? 'animate-spin' : ''} />
                  <span>{isCheckingStatus ? 'Checking...' : 'Check Approval Status'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setLoginIdentifier(activeFlowUser?.email || '');
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogIn size={13} />
                  <span>Go to Sign In</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. WAITING FOR ADMIN APPROVAL VIEW (WHEN LOGGING IN LATER) */}
          {/* ========================================================================= */}
          {viewMode === 'waiting_approval' && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                <Hourglass size={26} className="animate-pulse" />
              </div>

              <div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider inline-flex items-center gap-1 mb-2">
                  <Clock size={11} />
                  <span>Pending Administrator Acceptance</span>
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Waiting for Admin Approval
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Hello <strong>{activeFlowUser?.name || 'Team Member'}</strong>, your account is registered and email is verified. Studio Administrator{' '}
                  <strong className="text-slate-900">Ranjeet Patil</strong> (<code>ranjeet.patil@zapak.com</code>) must accept your request before you can enter the workspace.
                </p>
              </div>

              {/* User Account Info */}
              {activeFlowUser && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 text-left space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Account Name</span>
                    <span className="font-bold text-slate-900">{activeFlowUser.name}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Work Email</span>
                    <span className="font-mono text-slate-900">{activeFlowUser.email}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Assigned Office ID</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {activeFlowUser.officeId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Department & Title</span>
                    <span className="text-slate-900 font-medium">
                      {activeFlowUser.department} — {activeFlowUser.title}
                    </span>
                  </div>
                </div>
              )}

              {statusCheckMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium animate-in fade-in">
                  {statusCheckMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={isCheckingStatus ? 'animate-spin' : ''} />
                  <span>{isCheckingStatus ? 'Checking Status...' : 'Check Approval Status'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFlowUser(null);
                    setViewMode('login');
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Sign In with Different Account</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. REJECTED NOTICE VIEW */}
          {/* ========================================================================= */}
          {viewMode === 'rejected_notice' && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={26} />
              </div>

              <div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 uppercase tracking-wider inline-block mb-2">
                  Request Declined
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Access Request Declined
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Your studio access request was reviewed and declined by Studio Administrator.
                </p>
              </div>

              {activeFlowUser?.rejectionReason && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-left text-xs text-rose-900 space-y-1">
                  <p className="font-bold text-rose-950">Reason provided:</p>
                  <p className="text-[11px] leading-relaxed">{activeFlowUser.rejectionReason}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFlowUser(null);
                    setViewMode('login');
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
