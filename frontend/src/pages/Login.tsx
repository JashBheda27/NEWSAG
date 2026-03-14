import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { FormErrorMessage } from '../components/ui/FormErrorMessage';
import { useTheme } from '../hooks/useTheme';
import './Login.css';

type ViewType = 'login' | 'register';

interface CardBackgroundProps {
  activeView: ViewType;
}

interface HeroPanelProps {
  type: ViewType;
  activeView: ViewType;
  title: string;
  text: string;
  buttonText: string;
  onToggle: () => void;
}

interface FormProps {
  activeView: ViewType;
}

/* =========================
   Components
========================= */

const CardBackground = ({ activeView }: CardBackgroundProps) => {
  return <div className={`card-bg ${activeView === 'login' ? 'login' : ''}`} />;
};

const SocialButtons = () => {
  const { isLoaded, signIn } = useSignIn();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');

  // Added: Handler for Google OAuth login using Clerk's redirect flow
  const handleGoogle = async () => {
    if (!isLoaded) return;
    setOauthError('');
    setOauthLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/",
        redirectUrlComplete: "/"
      });
    } catch (err: any) {
      setOauthError(err.errors?.[0]?.message || 'Google OAuth failed');
    } finally {
      setOauthLoading(false);
    }
  };

  // Added: Handler for Facebook OAuth login using Clerk's redirect flow
  const handleFacebook = async () => {
    if (!isLoaded) return;
    setOauthError('');
    setOauthLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_facebook",
        redirectUrl: "/",
        redirectUrlComplete: "/"
      });
    } catch (err: any) {
      setOauthError(err.errors?.[0]?.message || 'Facebook OAuth failed');
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="sso">
      <button
        type="button"
        title="Google"
        aria-label="Continue with Google"
        className="fa-brands fa-google"
        onClick={handleGoogle}
        disabled={oauthLoading}
        style={{ cursor: oauthLoading ? 'not-allowed' : 'pointer', opacity: oauthLoading ? 0.5 : 1 }}
      />
      <button
        type="button"
        title="Facebook"
        aria-label="Continue with Facebook"
        className="fa-brands fa-facebook-f"
        onClick={handleFacebook}
        disabled={oauthLoading}
        style={{ cursor: oauthLoading ? 'not-allowed' : 'pointer', opacity: oauthLoading ? 0.5 : 1 }}
      />
      <FormErrorMessage message={oauthError} compact className="mt-2" />
    </div>
  );
};

const HeroPanel = ({ type, activeView, title, text, buttonText, onToggle }: HeroPanelProps) => {
  return (
    <div className={`hero ${type} ${activeView === type ? 'active' : ''}`}>
      <h2>{title}</h2>
      <p>{text}</p>
      <button type="button" onClick={onToggle}>
        {buttonText}
      </button>
    </div>
  );
};

const LoginForm = ({ activeView }: FormProps) => {
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setError('Loading...');
      setLoading(false);
      return;
    }

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        navigate('/');
      } else {
        // Try to set the session anyway - sometimes Clerk marks it incomplete but session exists.
        try {
          if (result.createdSessionId) {
            await setActive?.({ session: result.createdSessionId });
            navigate('/');
          } else {
            setError(`Login incomplete (${result.status}). Please check your Clerk dashboard settings.`);
          }
        } catch {
          setError('Login successful but session activation failed. Try refreshing the page.');
        }
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.message || 'Login failed';
      if (errorMessage.includes("Couldn't find your account")) {
        setError("Account not found. Please sign up first or check your email.");
      } else if (errorMessage.includes('password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={`form login ${activeView === 'login' ? 'active' : ''}`} onSubmit={handleSubmit}>
      <h2>Sign In</h2>
      <SocialButtons />
      <span>or use your email</span>

      <FormErrorMessage message={error} compact className="mb-2" />

      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
    </form>
  );
};

const RegisterForm = ({ activeView }: FormProps) => {
  const navigate = useNavigate();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setError('Loading...');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      // Create account with Clerk - generate unique username
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const username = email.split('@')[0] + '_' + timestamp;
      
      const result = await signUp.create({
        username: username, // Use email prefix + timestamp for uniqueness
        firstName: name.split(' ')[0] || 'User',
        lastName: name.split(' ').slice(1).join(' ') || '',
        emailAddress: email,
        password: password,
      });

      // Check if signup is complete
      if (result.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        navigate('/');
        return;
      }

      // Check if email verification is needed
      if (result.unverifiedFields && result.unverifiedFields.length > 0) {
        if (result.unverifiedFields.includes('email_address')) {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
        } else {
          setError('Additional verification required: ' + result.unverifiedFields.join(', '));
        }
      } else {
        // Try to set active session anyway - status might be wrong.
        try {
          if (result.createdSessionId) {
            await setActive?.({ session: result.createdSessionId });
            navigate('/');
          } else {
            setError(`Signup incomplete. Status: ${result.status}. Please go to Clerk dashboard → Configure → User & authentication and ensure all required fields are optional.`);
          }
        } catch {
          setError('Account created but activation failed. Try logging in or check Clerk dashboard settings.');
        }
      }
    } catch (err: any) {
      const errorMessage = err.errors?.[0]?.message || 'Registration failed';
      if (errorMessage.includes('password')) {
        setError('Password must be at least 8 characters and contain letters and numbers.');
      } else if (errorMessage.includes('email')) {
        setError('Invalid email or email already registered.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isLoaded) {
      setError('Loading...');
      setLoading(false);
      return;
    }

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        navigate('/');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return pendingVerification ? (
    <form className={`form register ${activeView === 'register' ? 'active' : ''}`} onSubmit={handleVerify}>
      <h2>Verify Email</h2>
      <span>Enter the verification code sent to {email}</span>

      <FormErrorMessage message={error} compact className="mb-2" />

      <input
        type="text"
        placeholder="Verification Code"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
    </form>
  ) : (
    <form className={`form register ${activeView === 'register' ? 'active' : ''}`} onSubmit={handleSubmit}>
      <h2>Create Account</h2>
      <SocialButtons />
      <span>or use your email</span>

      <FormErrorMessage message={error} compact className="mb-2" />

      <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
};

/* =========================
   Main Component
========================= */

export const Login: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('login');
  const { isDark } = useTheme();

  const toggleView = () => {
    setActiveView((prev) => (prev === 'login' ? 'register' : 'login'));
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '10px',
      width: '100%',
      boxSizing: 'border-box',
      backgroundColor: isDark ? '#0f172a' : '#f5f5f5',
      transition: 'background-color 200ms ease'
    }}>
      <div className="card">
        <CardBackground activeView={activeView} />

        <HeroPanel
          type="register"
          activeView={activeView}
          title="Welcome Back"
          text="To keep connected with us please login with your personal info"
          buttonText="LOGIN"
          onToggle={toggleView}
        />

        <RegisterForm activeView={activeView} />

        <HeroPanel
          type="login"
          activeView={activeView}
          title="Hello, Friend!"
          text="Enter your personal details and start your journey with us"
          buttonText="SIGN UP"
          onToggle={toggleView}
        />

        <LoginForm activeView={activeView} />

        <div className="toggle-footer">
          <p>
            {activeView === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button 
              type="button" 
              onClick={toggleView}
              className="toggle-button"
            >
              {activeView === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
