import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, AtSign, KeyRound } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Props = {
  onBack: () => void;
  onAuthenticated: (session: Session) => void;
};

type Mode = "signin" | "signup";

export default function NativeAuth({ onBack, onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const configured = Boolean(supabase);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!supabase) {
      setError("SweetCord account login is not connected yet. Configure the Supabase URL and publishable key in .env.local.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (mode === "signup") {
      const normalizedUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
        setError("Username must be 3–24 characters and use only letters, numbers, or underscores.");
        return;
      }
      if (displayName.trim().length > 40) {
        setError("Display name must be 40 characters or fewer.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              username: username.trim().toLowerCase(),
              display_name: displayName.trim() || username.trim()
            }
          }
        });

        if (authError) throw authError;
        if (data.session) {
          onAuthenticated(data.session);
          return;
        }

        setNotice("Account request received. Check your email to confirm the address, then sign in here.");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (authError) throw authError;
        if (!data.session) throw new Error("Sign-in completed without an active session. Please try again.");
        onAuthenticated(data.session);
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "Authentication failed. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login-card native-auth-card" aria-labelledby="native-auth-title">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={15} /> Back to sign-in options
      </button>
      <div className="card-brand"><div className="brand-mark"><KeyRound size={22} /></div></div>
      <div className="eyebrow">SWEETCORD ACCOUNT</div>
      <h2 id="native-auth-title">{mode === "signin" ? <>Welcome<br />back.</> : <>Make it<br />your space.</>}</h2>
      <p className="card-subtitle">
        {mode === "signin" ? "Sign in to your SweetCord account to manage your squad." : "Create a free account. Voice and messaging won't be paywalled."}
      </p>

      {!configured && (
        <div className="notice notice-info" role="status">
          <span className="notice-dot" />
          <span>Account service isn't connected yet. You can review this screen, but sign-in won't work until a dedicated Supabase project is configured.</span>
        </div>
      )}
      {error && <div className="notice notice-error" role="alert"><span className="notice-dot" /><span>{error}</span></div>}
      {notice && <div className="notice notice-info" role="status"><span className="notice-dot" /><span>{notice}</span></div>}

      <form className="native-auth-form" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <>
            <label className="field-label" htmlFor="sweetcord-username">Username</label>
            <div className="field-wrap"><AtSign size={16} /><input id="sweetcord-username" autoComplete="username" maxLength={24} placeholder="your_gamertag" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
            <label className="field-label" htmlFor="sweetcord-display-name">Display name <span>Optional</span></label>
            <div className="field-wrap"><input id="sweetcord-display-name" autoComplete="nickname" maxLength={40} placeholder="How friends see you" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          </>
        )}
        <label className="field-label" htmlFor="sweetcord-email">Email address</label>
        <div className="field-wrap"><AtSign size={16} /><input id="sweetcord-email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <label className="field-label" htmlFor="sweetcord-password">Password</label>
        <div className="field-wrap"><KeyRound size={16} /><input id="sweetcord-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} maxLength={128} placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="primary-button" type="submit" disabled={busy || !configured}>
          {busy ? "Please wait..." : mode === "signin" ? "Sign in to SweetCord" : "Create free account"}
          {!busy && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="auth-switch">
        <span>{mode === "signin" ? "New to SweetCord?" : "Already have an account?"}</span>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>
          {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </div>
      <div className="secure-note"><KeyRound size={15} /><span>These are SweetCord credentials, not your Discord password or token. Passwords are handled by Supabase Auth.</span></div>
    </section>
  );
}
