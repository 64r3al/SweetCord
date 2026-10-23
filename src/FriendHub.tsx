import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleUserRound, LogOut, MessageCircle, RefreshCw, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
};

type FriendshipRow = { user_low_id: string; user_high_id: string };
type RequestRow = { id: string; sender_id: string; recipient_id: string; created_at: string };
type RequestWithProfile = RequestRow & { profile?: Profile };

type Props = { session: Session; onSignOut: () => void };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "That request couldn't be completed. Please try again.";
}

function ProfileAvatar({ profile }: { profile?: Profile }) {
  if (profile?.avatar_url) {
    return <img className="friend-avatar" src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />;
  }
  return <div className="friend-avatar friend-avatar-fallback">{(profile?.display_name || profile?.username || "?").slice(0, 1).toUpperCase()}</div>;
}

export default function FriendHub({ session, onSignOut }: Props) {
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<RequestWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<RequestWithProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const userId = session.user.id;
  const userEmail = session.user.email ?? "";

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    try {
      const [profileResult, friendshipResult, incomingResult, outgoingResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("friendships").select("user_low_id,user_high_id").or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`),
        supabase.from("friend_requests").select("id,sender_id,recipient_id,created_at").eq("recipient_id", userId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("friend_requests").select("id,sender_id,recipient_id,created_at").eq("sender_id", userId).eq("status", "pending").order("created_at", { ascending: false })
      ]);

      const firstError = profileResult.error || friendshipResult.error || incomingResult.error || outgoingResult.error;
      if (firstError) throw firstError;

      const friendshipRows = (friendshipResult.data ?? []) as FriendshipRow[];
      const incomingRows = (incomingResult.data ?? []) as RequestRow[];
      const outgoingRows = (outgoingResult.data ?? []) as RequestRow[];
      const friendIds = friendshipRows.map((row) => row.user_low_id === userId ? row.user_high_id : row.user_low_id);
      const requestUserIds = [
        ...incomingRows.map((row) => row.sender_id),
        ...outgoingRows.map((row) => row.recipient_id)
      ];
      const relatedIds = Array.from(new Set([...friendIds, ...requestUserIds]));

      const relatedResult = relatedIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", relatedIds)
        : { data: [], error: null };
      if (relatedResult.error) throw relatedResult.error;

      const relatedProfiles = (relatedResult.data ?? []) as Profile[];
      const byId = new Map(relatedProfiles.map((profile) => [profile.id, profile]));

      setOwnProfile((profileResult.data as Profile | null) ?? null);
      setFriends(friendIds.map((id) => byId.get(id)).filter((p): p is Profile => Boolean(p)));
      setIncoming(incomingRows.map((row) => ({ ...row, profile: byId.get(row.sender_id) })));
      setOutgoing(outgoingRows.map((row) => ({ ...row, profile: byId.get(row.recipient_id) })));
    } catch (caught: unknown) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleAddFriend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const normalized = query.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      setError("Enter the exact username (3–24 letters, numbers, or underscores).");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");
    try {
      const { data, error: searchError } = await supabase.rpc("find_profile_by_username", { p_username: normalized });
      if (searchError) throw searchError;
      const target = Array.isArray(data) ? (data[0] as Profile | undefined) : (data as Profile | null);
      if (!target) throw new Error("No SweetCord user found with that exact username.");
      if (target.id === userId) throw new Error("You can't send a friend request to yourself.");
      if (friends.some((friend) => friend.id === target.id)) throw new Error("You're already friends with this user.");

      const { error: insertError } = await supabase.from("friend_requests").insert({
        sender_id: userId,
        recipient_id: target.id,
        status: "pending"
      });
      if (insertError) {
        if (insertError.code === "23505") throw new Error("A pending request already exists between these accounts.");
        throw insertError;
      }

      setQuery("");
      setNotice(`Friend request sent to @${target.username}.`);
      await loadData();
    } catch (caught: unknown) {
      setError(getErrorMessage(caught));
    } finally {
      setSearching(false);
    }
  };

  const respondToRequest = async (request: RequestWithProfile, status: "accepted" | "rejected") => {
    if (!supabase) return;
    setMutatingId(request.id);
    setError("");
    setNotice("");

    try {
      const { data, error: updateError } = await supabase
        .from("friend_requests")
        .update({ status })
        .eq("id", request.id)
        .eq("recipient_id", userId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!data) throw new Error("This request has already changed. Refresh and try again.");

      setNotice(status === "accepted" ? `You and @${request.profile?.username ?? "your friend"} are now connected.` : "Friend request declined.");
      await loadData();
    } catch (caught: unknown) {
      setError(getErrorMessage(caught));
    } finally {
      setMutatingId(null);
    }
  };

  const sortedFriends = useMemo(() => [...friends].sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username)), [friends]);

  const handleSignOut = async () => {
    if (!supabase) {
      onSignOut();
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else onSignOut();
  };

  return (
    <main className="native-dashboard">
      <aside className="dashboard-sidebar">
        <div className="preview-brand"><div className="brand-mark"><Users size={20} /></div><span>sweetcord</span></div>
        <div className="side-label">YOUR SPACE</div>
        <div className="side-item active"><Users size={17} /> Friends <span className="side-count">{friends.length}</span></div>
        <div className="side-item"><MessageCircle size={17} /> Messages <span className="side-count">SOON</span></div>
        <div className="sidebar-spacer" />
        <button className="sidebar-signout" onClick={() => void handleSignOut()}><LogOut size={16} /> Sign out</button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="online-dot" /> YOUR SQUAD <span className="preview-divider">/</span> <span className="muted">Friends and requests</span></div>
          <button className="subtle-icon-button" onClick={() => void loadData()} disabled={loading} aria-label="Refresh friends" title="Refresh"><RefreshCw size={15} /></button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">YOUR PEOPLE, ONE PLACE</span>
              <h1>Friends.</h1>
              <p>{ownProfile ? `Signed in as @${ownProfile.username}` : userEmail}</p>
            </div>
            <div className="dashboard-account-chip"><CircleUserRound size={17} /><span>{userEmail || "SweetCord account"}</span><ShieldCheck size={16} /></div>
          </div>

          {error && <div className="notice notice-error dashboard-notice" role="alert"><span className="notice-dot" /><span>{error}</span></div>}
          {notice && <div className="notice notice-info dashboard-notice" role="status"><span className="notice-dot" /><span>{notice}</span></div>}

          <form className="friend-search" onSubmit={handleAddFriend}>
            <Search size={18} />
            <input aria-label="Friend's exact username" placeholder="Add friend by exact username…" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={25} />
            <button type="submit" disabled={searching || !query.trim()}>{searching ? "Searching…" : "Add friend"} <ArrowRight size={16} /></button>
          </form>
          <p className="search-hint">Usernames only. SweetCord never searches or exposes account emails.</p>

          <div className="dashboard-columns">
            <section className="dashboard-section">
              <div className="section-heading"><h2>Friends <span>{friends.length}</span></h2></div>
              {loading ? <p className="empty-state">Loading your squad…</p> : sortedFriends.length ? (
                <div className="friend-list">
                  {sortedFriends.map((friend) => (
                    <div className="friend-row" key={friend.id}>
                      <ProfileAvatar profile={friend} />
                      <div className="friend-copy"><strong>{friend.display_name || friend.username}</strong><span>@{friend.username}</span></div>
                      <span className="friend-status">Connected</span>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state"><Users size={24} /><strong>Your squad starts here.</strong><span>Add friends by their exact SweetCord username.</span></div>}
            </section>

            <section className="dashboard-section">
              <div className="section-heading"><h2>Requests <span>{incoming.length}</span></h2></div>
              {loading ? <p className="empty-state">Checking requests…</p> : incoming.length ? (
                <div className="request-list">
                  {incoming.map((request) => (
                    <div className="request-row" key={request.id}>
                      <ProfileAvatar profile={request.profile} />
                      <div className="friend-copy"><strong>{request.profile?.display_name || request.profile?.username || "SweetCord user"}</strong><span>@{request.profile?.username || "unknown"}</span></div>
                      <div className="request-actions">
                        <button className="accept-request" aria-label="Accept friend request" title="Accept" disabled={mutatingId === request.id} onClick={() => void respondToRequest(request, "accepted")}><Check size={16} /></button>
                        <button className="reject-request" aria-label="Decline friend request" title="Decline" disabled={mutatingId === request.id} onClick={() => void respondToRequest(request, "rejected")}><X size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state"><UserPlus size={24} /><strong>All caught up.</strong><span>New requests will show up here.</span></div>}

              {outgoing.length > 0 && (
                <div className="outgoing-requests">
                  <h3>Sent <span>{outgoing.length}</span></h3>
                  {outgoing.map((request) => (
                    <div className="outgoing-row" key={request.id}>
                      <span>@{request.profile?.username || "unknown"}</span><small>Pending</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="dashboard-footnote"><ShieldCheck size={14} /><span>Friend lists are private to account members. You control the requests you accept.</span></div>
        </div>
      </section>
    </main>
  );
}
