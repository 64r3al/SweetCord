import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import NativeAuth from "./NativeAuth";
import FriendHub from "./FriendHub";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  AtSign,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Gamepad2,
  Heart,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Mic2,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import {
  completeDiscordOAuth,
  getDiscordAvatarUrl,
  startDiscordOAuth,
  type DiscordProfile
} from "./lib/discordOAuth";

type Notice = { kind: "error" | "info"; message: string } | null;

const demoProfile: DiscordProfile = {
  id: "sweetcord-demo-user",
  username: "squadmate_demo",
  global_name: "Squadmate (Demo)",
  avatar: null
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Headphones size={23} strokeWidth={2.1} />
      <span className="brand-mark-dot" />
    </div>
  );
}

function Avatar({ profile, demo = false }: { profile: DiscordProfile; demo?: boolean }) {
  const avatarUrl = demo ? null : getDiscordAvatarUrl(profile);
  const label = profile.global_name || profile.username;
  return (
    <div className={`profile-avatar${demo ? " profile-avatar-demo" : ""}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${label}'s avatar`} />
      ) : (
        <span>{(label.trim().slice(0, 1) || "S").toUpperCase()}</span>
      )}
      <i className="avatar-presence" />
    </div>
  );
}

function ProfileConfirmation({
  profile,
  demo,
  onContinue,
  onSignOut
}: {
  profile: DiscordProfile;
  demo: boolean;
  onContinue: () => void;
  onSignOut: () => void;
}) {
  const displayName = profile.global_name || profile.username;

  return (
    <section className="login-card profile-card" aria-labelledby="profile-title">
      <div className="success-icon"><Check size={22} /></div>
      <div className="eyebrow">{demo ? "LOCAL PREVIEW" : "ACCOUNT VERIFIED"}</div>
      <h1 id="profile-title">{demo ? "Demo profile ready" : "Is this you?"}</h1>
      <p className="card-subtitle">
        {demo
          ? "This is a sample profile for testing the interface. No Discord account was accessed."
          : "Confirm the profile returned by the official sign-in flow before continuing."}
      </p>

      <div className="identity-panel">
        <Avatar profile={profile} demo={demo} />
        <div className="identity-copy">
          <strong>{displayName}</strong>
          <span>@{profile.username}</span>
          <small>{demo ? "Demo account · local only" : `Discord ID · ${profile.id}`}</small>
        </div>
        <span className="identity-check"><ShieldCheck size={18} /></span>
      </div>

      {demo && (
        <div className="demo-note">
          <Sparkles size={16} />
          <span>Demo mode is temporary and resets when this page reloads.</span>
        </div>
      )}

      <button className="primary-button" onClick={onContinue}>
        {demo ? "Explore the preview" : "Confirm and continue"}
        <ArrowRight size={17} />
      </button>
      <button className="text-button" onClick={onSignOut}>Use another account</button>
    </section>
  );
}

function HomePreview({ profile, demo, onSignOut }: { profile: DiscordProfile; demo: boolean; onSignOut: () => void }) {
  return (
    <main className="app-preview">
      <aside className="preview-sidebar">
        <div className="preview-brand"><BrandMark /><span>sweetcord</span></div>
        <div className="side-label">YOUR SPACE</div>
        <div className="side-item active"><Headphones size={17} /> Voice lounge</div>
        <div className="side-item"><MessageCircle size={17} /> Messages <span className="side-count">0</span></div>
        <div className="side-item"><Gamepad2 size={17} /> Friends</div>
        <div className="sidebar-spacer" />
        <div className="mini-profile">
          <Avatar profile={profile} demo={demo} />
          <div><strong>{profile.global_name || profile.username}</strong><small>{demo ? "Demo mode" : "Discord verified"}</small></div>
          <button className="icon-button" onClick={onSignOut} title="Sign out" aria-label="Sign out"><ChevronRight size={17} /></button>
        </div>
      </aside>
      <section className="preview-main">
        <header className="preview-topbar">
          <div><span className="online-dot" /> SQUAD LOUNGE <span className="preview-divider">/</span> <span className="muted">Voice first</span></div>
          <span className="build-pill">EARLY PREVIEW</span>
        </header>
        <div className="lounge-content">
          <div className="lounge-icon"><AudioLines size={27} /></div>
          <span className="eyebrow">YOUR CREW, YOUR CALL</span>
          <h1>Ready when<br />your squad is.</h1>
          <p>The foundation is here. Voice rooms and messages will connect here as the next features land.</p>
          <div className="feature-status">
            <div><span className="status-icon"><Mic2 size={17} /></span><div><strong>Voice rooms</strong><small>Coming in the next build</small></div><span className="status-tag">NEXT UP</span></div>
            <div><span className="status-icon"><MessageCircle size={17} /></span><div><strong>Simple messaging</strong><small>Lightweight by design</small></div><span className="status-tag">PLANNED</span></div>
          </div>
          <button className="text-button back-login" onClick={onSignOut}>Back to sign in</button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [profile, setProfile] = useState<DiscordProfile | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [nativeAuthOpen, setNativeAuthOpen] = useState(false);
  const [nativeSession, setNativeSession] = useState<Session | null>(null);
  const [nativeAuthLoading, setNativeAuthLoading] = useState(Boolean(supabase));
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setNativeAuthLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setNativeSession(session);
        setNativeAuthLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice({ kind: "error", message: "Couldn't restore your SweetCord session. Sign in again if needed." });
      setNativeSession(data.session);
      setNativeAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // When Supabase is configured, it owns the OAuth callback and PKCE exchange.
    // The standalone identity-preview callback is only used without Supabase config.
    if (supabase) return;
    if (callbackHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return;
    callbackHandled.current = true;

    setBusy(true);
    completeDiscordOAuth()
      .then((returnedProfile) => {
        if (returnedProfile) {
          setProfile(returnedProfile);
          setDemo(false);
          setNotice({ kind: "info", message: "Discord identity verified. Review the account details below." });
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Sign-in failed. Please try again.";
        setNotice({ kind: "error", message });
      })
      .finally(() => {
        // Remove the authorization code from the address bar as soon as it is handled.
        window.history.replaceState({}, document.title, window.location.pathname);
        setBusy(false);
      });
  }, []);

  const clearSession = () => {
    setProfile(null);
    setConfirmed(false);
    setDemo(false);
    setNotice(null);
  };

  const handleDiscordLogin = async () => {
    setNotice(null);
    setBusy(true);
    try {
      if (supabase) {
        // Real SweetCord sign-in: Supabase manages the OAuth code exchange,
        // PKCE/session lifecycle, and creates or restores the SweetCord account.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
        return;
      }

      // Without a configured SweetCord backend, allow only profile-identity
      // preview through the separate server-side code exchange—not a session.
      await startDiscordOAuth();
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "Could not start Discord sign-in. Check the Supabase Discord provider configuration."
      });
      setBusy(false);
    }
  };

  const handleDemo = () => {
    setProfile(demoProfile);
    setDemo(true);
    setConfirmed(false);
    setNotice({ kind: "info", message: "Demo mode: using a local sample profile only." });
  };

  if (nativeAuthLoading) {
    return (
      <main className="page-shell auth-loading-shell">
        <div className="auth-loading"><div className="brand-mark"><Headphones size={22} /></div><span>Restoring your SweetCord session…</span></div>
      </main>
    );
  }

  if (nativeSession) {
    return <FriendHub session={nativeSession} onSignOut={() => setNativeSession(null)} />;
  }

  if (profile && confirmed) {
    return <HomePreview profile={profile} demo={demo} onSignOut={clearSession} />;
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-overlay" />
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="SweetCord home">
          <BrandMark /><span>sweet<span>cord</span></span>
        </a>
        <div className="topbar-note"><span className="topbar-pulse" /> EARLY ACCESS <span className="topbar-separator">/</span> BUILT FOR GAMERS</div>
        <a className="help-link" href="https://github.com/64r3al/SweetCord" target="_blank" rel="noreferrer"><CircleHelp size={16} /> Project</a>
      </header>

      <div className="landing-layout">
        <section className="story-panel">
          <div className="story-kicker"><span className="kicker-line" /> A LITTLE LESS NOISE</div>
          <h1>Stay in the game.<br /><span>Not in the way.</span></h1>
          <p className="story-description">
            Your squad, your voice, your messages. Nothing extra fighting for your PC's attention.
          </p>
          <div className="benefit-list">
            <div className="benefit-row">
              <span className="benefit-icon"><Zap size={18} /></span>
              <div><strong>Light on your setup</strong><p>Designed with older PCs and demanding games in mind.</p></div>
            </div>
            <div className="benefit-row">
              <span className="benefit-icon"><Headphones size={18} /></span>
              <div><strong>Voice comes first</strong><p>Get your people together without the extra noise.</p></div>
            </div>
            <div className="benefit-row">
              <span className="benefit-icon"><LockKeyhole size={18} /></span>
              <div><strong>Your account stays yours</strong><p>Official sign-in flow. No Discord password or user-token collection.</p></div>
            </div>
          </div>
          <div className="community-line"><Heart size={15} /><span>Built for the community, not a subscription wall.</span></div>
        </section>

        <section className="auth-column">
          {profile ? (
            <ProfileConfirmation
              profile={profile}
              demo={demo}
              onContinue={() => setConfirmed(true)}
              onSignOut={clearSession}
            />
          ) : nativeAuthOpen ? (
            <NativeAuth
              onBack={() => setNativeAuthOpen(false)}
              onAuthenticated={(session) => {
                setNativeSession(session);
                setNativeAuthOpen(false);
              }}
            />
          ) : (
            <div className="login-card">
              <div className="card-brand"><BrandMark /></div>
              <div className="eyebrow">WELCOME TO SWEETCORD</div>
              <h2>Your people are<br />one click away.</h2>
              <p className="card-subtitle">A simpler place to talk while you play.</p>

              {notice && (
                <div className={`notice notice-${notice.kind}`} role="status">
                  <span className="notice-dot" />
                  <span>{notice.message}</span>
                </div>
              )}

              <button className="discord-button" onClick={handleDiscordLogin} disabled={busy}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="discord-glyph">
                  <path fill="currentColor" d="M19.73 5.14a18.9 18.9 0 0 0-4.66-1.45.07.07 0 0 0-.07.03c-.2.36-.42.83-.57 1.2a17.5 17.5 0 0 0-5.26 0c-.16-.39-.38-.84-.58-1.2a.07.07 0 0 0-.07-.03A18.8 18.8 0 0 0 3.86 5.14a.06.06 0 0 0-.03.03C.87 9.6.07 13.93.47 18.2a.08.08 0 0 0 .03.05 19 19 0 0 0 5.72 2.9.07.07 0 0 0 .08-.03c.44-.6.83-1.24 1.17-1.92a.07.07 0 0 0-.04-.1 12.5 12.5 0 0 1-1.79-.85.07.07 0 0 1-.01-.12c.12-.09.24-.19.36-.28a.07.07 0 0 1 .07-.01c3.76 1.72 7.83 1.72 11.55 0a.07.07 0 0 1 .07.01c.12.1.24.19.36.28a.07.07 0 0 1-.01.12c-.57.34-1.17.62-1.79.85a.07.07 0 0 0-.04.1c.34.67.73 1.31 1.17 1.91a.07.07 0 0 0 .08.03 19 19 0 0 0 5.73-2.9.07.07 0 0 0 .03-.05c.48-4.94-.8-9.24-3.37-13.03a.06.06 0 0 0-.03-.03ZM8.45 14.78c-1.13 0-2.06-1.04-2.06-2.32s.91-2.32 2.06-2.32c1.16 0 2.08 1.05 2.06 2.32 0 1.28-.91 2.32-2.06 2.32Zm7.1 0c-1.13 0-2.06-1.04-2.06-2.32s.91-2.32 2.06-2.32c1.16 0 2.08 1.05 2.06 2.32 0 1.28-.9 2.32-2.06 2.32Z" />
                </svg>
                {busy ? "Connecting..." : "Continue with Discord"}
                {!busy && <ArrowRight size={17} />}
              </button>

              <div className="or-divider"><span /> <small>ANOTHER WAY TO SIGN IN</small> <span /></div>

              <button className="account-button" onClick={() => { setNativeAuthOpen(true); setNotice(null); }} disabled={busy}>
                <AtSign size={17} />
                Continue with email
                <ChevronRight size={16} />
              </button>

              <div className="demo-separator"><span /> LOCAL PREVIEW ONLY <span /></div>
              <button className="demo-button" onClick={handleDemo} disabled={busy}>
                <Sparkles size={17} />
                Explore with a demo profile
                <ChevronRight size={16} />
              </button>

              <div className="secure-note"><ShieldCheck size={15} /><span>Discord sign-in is optional in this UI preview. Demo mode uses no account data.</span></div>
            </div>
          )}
          <div className="auth-footnote">Free core features <span>·</span> No Nitro required <span>·</span> Made for your squad</div>
        </section>
      </div>

      <footer className="page-footer">
        <span>© {new Date().getFullYear()} SweetCord · Community-built</span>
        <span className="footer-right">UNOFFICIAL PROJECT <span className="footer-dot">●</span> NOT AFFILIATED WITH DISCORD</span>
      </footer>
    </main>
  );
}
