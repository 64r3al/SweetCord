import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowLeft, ArrowRight, AtSign, Check, ChevronDown, CircleHelp,
  Compass, Hash, Headphones, LogOut, MessageCircle, MoreHorizontal, Plus,
  RefreshCw, Send, Settings2, ShieldCheck, Sparkles, UserPlus,
  Users, X, Zap
} from "lucide-react";
import { supabase } from "./lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};
type Workspace = { id: string; name: string; kind: "server" | "group"; owner_id: string };
type WorkspaceMember = { workspace_id: string; user_id: string; role: "owner" | "admin" | "member" };
type WorkspaceChannel = { id: string; workspace_id: string; name: string; kind: "text"; topic: string | null; position: number };
type Conversation = { id: string; kind: "direct" | "group"; title: string | null; created_at: string };
type ConversationParticipant = { conversation_id: string; user_id: string };
type Message = { id: string; channel_id: string | null; conversation_id: string | null; sender_id: string; content: string; created_at: string; edited_at: string | null; sender?: Profile };
type FriendRequest = { id: string; sender_id: string; recipient_id: string; status: "pending" | "accepted" | "rejected"; created_at: string; profile?: Profile };
type ModalKind = "new-dm" | "new-group-dm" | "new-workspace" | "add-friend" | "new-channel" | "invite" | null;

type Props = { session: Session; onSignOut: () => void };

function readableError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || "";
    if (/relation .* does not exist|schema cache|Could not find the table/i.test(message)) {
      return "The SweetCord database isn't fully set up yet. Apply the SQL files in supabase/schema to your dedicated SweetCord Supabase project.";
    }
    return message || "That action couldn't be completed. Please try again.";
  }
  return "That action couldn't be completed. Please try again.";
}

function Avatar({ profile, size = "normal" }: { profile?: Profile | null; size?: "normal" | "small" | "large" }) {
  const label = profile?.display_name || profile?.username || "SweetCord";
  if (profile?.avatar_url) {
    return <img className={`sc-avatar sc-avatar-${size}`} src={profile.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  }
  return <div className={`sc-avatar sc-avatar-${size} sc-avatar-fallback`} aria-label={label}>{label.slice(0, 1).toUpperCase()}</div>;
}

function timeLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatHub({ session, onSignOut }: Props) {
  const userId = session.user.id;
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [channels, setChannels] = useState<WorkspaceChannel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalName, setModalName] = useState("");
  const [modalKind, setModalKind] = useState<"server" | "group">("server");
  const [usernames, setUsernames] = useState("");
  const [channelKind, setChannelKind] = useState<"text">("text");
  const [inviteUsername, setInviteUsername] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const didInitialSelection = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? null;
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeChannels = channels.filter((channel) => channel.workspace_id === activeWorkspaceId).sort((a, b) => a.position - b.position);
  const activeMembers = workspaceMembers.filter((member) => member.workspace_id === activeWorkspaceId);
  const canManageWorkspace = Boolean(activeWorkspace && activeMembers.some((member) => member.user_id === userId && (member.role === "owner" || member.role === "admin")));
  const userEmail = session.user.email ?? "SweetCord account";
  const activeConversationUsers = activeConversation
    ? participants.filter((participant) => participant.conversation_id === activeConversation.id && participant.user_id !== userId).map((participant) => profileById.get(participant.user_id)).filter((profile): profile is Profile => Boolean(profile))
    : [];
  const conversationTitle = activeConversation
    ? activeConversation.kind === "group"
      ? activeConversation.title || activeConversationUsers.map((profile) => profile.display_name || profile.username).join(", ") || "Group conversation"
      : activeConversationUsers[0]?.display_name || activeConversationUsers[0]?.username || "Direct message"
    : "";

  const loadData = useCallback(async (preferredWorkspaceId?: string) => {
    if (!supabase) {
      setError("Connect SweetCord to its dedicated Supabase project before signing in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [profileResult, membershipResult, friendshipResult, incomingResult, outgoingResult, ownParticipantResult] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("workspace_members").select("workspace_id,user_id,role").eq("user_id", userId),
        supabase.from("friendships").select("user_low_id,user_high_id").or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`),
        supabase.from("friend_requests").select("id,sender_id,recipient_id,status,created_at").eq("recipient_id", userId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("friend_requests").select("id,sender_id,recipient_id,status,created_at").eq("sender_id", userId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("dm_participants").select("conversation_id,user_id").eq("user_id", userId)
      ]);
      const firstError = profileResult.error || membershipResult.error || friendshipResult.error || incomingResult.error || outgoingResult.error || ownParticipantResult.error;
      if (firstError) throw firstError;

      const memberRows = (membershipResult.data ?? []) as WorkspaceMember[];
      const workspaceIds = [...new Set(memberRows.map((row) => row.workspace_id))];
      const [workspaceResult, channelResult] = workspaceIds.length
        ? await Promise.all([
            supabase.from("workspaces").select("id,name,kind,owner_id").in("id", workspaceIds).order("name"),
            supabase.from("workspace_channels").select("id,workspace_id,name,kind,topic,position").in("workspace_id", workspaceIds).order("position")
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (workspaceResult.error || channelResult.error) throw workspaceResult.error || channelResult.error;
      const workspaceRows = (workspaceResult.data ?? []) as Workspace[];
      const channelRows = (channelResult.data ?? []) as WorkspaceChannel[];

      const participantRows = (ownParticipantResult.data ?? []) as ConversationParticipant[];
      const conversationIds = [...new Set(participantRows.map((row) => row.conversation_id))];
      const [conversationResult, allParticipantsResult] = conversationIds.length
        ? await Promise.all([
            supabase.from("dm_conversations").select("id,kind,title,created_at").in("id", conversationIds).order("created_at", { ascending: false }),
            supabase.from("dm_participants").select("conversation_id,user_id").in("conversation_id", conversationIds)
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (conversationResult.error || allParticipantsResult.error) throw conversationResult.error || allParticipantsResult.error;

      const friendshipRows = (friendshipResult.data ?? []) as { user_low_id: string; user_high_id: string }[];
      const friendIds = friendshipRows.map((row) => row.user_low_id === userId ? row.user_high_id : row.user_low_id);
      const incomingRows = (incomingResult.data ?? []) as Omit<FriendRequest, "profile">[];
      const outgoingRows = (outgoingResult.data ?? []) as Omit<FriendRequest, "profile">[];
      const allParticipantRows = (allParticipantsResult.data ?? []) as ConversationParticipant[];
      const relatedIds = [...new Set([
        userId,
        ...friendIds,
        ...incomingRows.map((row) => row.sender_id),
        ...outgoingRows.map((row) => row.recipient_id),
        ...memberRows.filter((row) => row.workspace_id && row.user_id !== userId).map((row) => row.user_id),
        ...allParticipantRows.map((row) => row.user_id)
      ])];
      const relatedResult = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", relatedIds);
      if (relatedResult.error) throw relatedResult.error;
      const profileRows = (relatedResult.data ?? []) as Profile[];
      const byId = new Map(profileRows.map((profile) => [profile.id, profile]));

      setOwnProfile((profileResult.data as Profile | null) ?? null);
      setWorkspaceMembers(memberRows);
      setWorkspaces(workspaceRows);
      setChannels(channelRows);
      setConversations((conversationResult.data ?? []) as Conversation[]);
      setParticipants(allParticipantRows);
      setProfiles(profileRows);
      setFriends(friendIds.map((id) => byId.get(id)).filter((profile): profile is Profile => Boolean(profile)));
      setIncomingRequests(incomingRows.map((row) => ({ ...row, profile: byId.get(row.sender_id) })));
      setOutgoingRequests(outgoingRows.map((row) => ({ ...row, profile: byId.get(row.recipient_id) })));

      if (preferredWorkspaceId) {
        didInitialSelection.current = true;
        const preferredChannels = channelRows.filter((channel) => channel.workspace_id === preferredWorkspaceId).sort((a, b) => a.position - b.position);
        setActiveWorkspaceId(preferredWorkspaceId);
        setActiveChannelId(preferredChannels[0]?.id ?? null);
        setActiveConversationId(null);
      } else if (!didInitialSelection.current) {
        const firstConversation = (conversationResult.data ?? [])[0] as Conversation | undefined;
        const firstWorkspace = workspaceRows[0];
        if (firstConversation) {
          setActiveConversationId(firstConversation.id);
        } else if (firstWorkspace) {
          setActiveWorkspaceId(firstWorkspace.id);
          setActiveChannelId(channelRows.find((channel) => channel.workspace_id === firstWorkspace.id)?.id ?? null);
        }
        didInitialSelection.current = true;
      }
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const loadMessages = useCallback(async () => {
    if (!supabase) return;
    if (!activeConversationId && !activeChannelId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      let query = supabase.from("messages").select("id,channel_id,conversation_id,sender_id,content,created_at,edited_at").order("created_at", { ascending: false }).limit(100);
      if (activeConversationId) query = query.eq("conversation_id", activeConversationId);
      else if (activeChannelId) query = query.eq("channel_id", activeChannelId);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      const rows = [...((data ?? []) as Message[])].reverse();
      const senderIds = [...new Set(rows.map((row) => row.sender_id))];
      const senderResult = senderIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", senderIds)
        : { data: [], error: null };
      if (senderResult.error) throw senderResult.error;
      const senders = new Map(((senderResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      setMessages(rows.map((row) => ({ ...row, sender: senders.get(row.sender_id) })));
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setMessagesLoading(false);
    }
  }, [activeChannelId, activeConversationId]);

  useEffect(() => {
    void loadMessages();
    if (!supabase || (!activeChannelId && !activeConversationId)) return;
    const filter = activeConversationId ? `conversation_id=eq.${activeConversationId}` : `channel_id=eq.${activeChannelId}`;
    const live = supabase.channel(`sweetcord-messages-${activeConversationId || activeChannelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter }, () => { void loadMessages(); })
      .subscribe();
    return () => { void supabase?.removeChannel(live); };
  }, [activeChannelId, activeConversationId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeConversationId, activeChannelId]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const content = composer.trim();
    if (!content || (!activeChannelId && !activeConversationId) || working) return;
    if (content.length > 4000) {
      setError("Messages must be 4,000 characters or fewer.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const payload = activeConversationId
        ? { conversation_id: activeConversationId, channel_id: null, sender_id: userId, content }
        : { channel_id: activeChannelId, conversation_id: null, sender_id: userId, content };
      const { error: insertError } = await supabase.from("messages").insert(payload);
      if (insertError) throw insertError;
      setComposer("");
      await loadMessages();
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const openWorkspace = (workspace: Workspace) => {
    const first = channels.filter((channel) => channel.workspace_id === workspace.id).sort((a, b) => a.position - b.position)[0];
    setActiveWorkspaceId(workspace.id);
    setActiveChannelId(first?.id ?? null);
    setActiveConversationId(null);
    setMobileSidebarOpen(false);
    setError("");
    setNotice("");
  };

  const openChannel = (channel: WorkspaceChannel) => {
    setActiveWorkspaceId(channel.workspace_id);
    setActiveChannelId(channel.id);
    setActiveConversationId(null);
    setMobileSidebarOpen(false);
    setError("");
    setNotice("");
  };

  const openConversation = (conversationId: string) => {
    setActiveWorkspaceId(null);
    setActiveChannelId(null);
    setActiveConversationId(conversationId);
    setMobileSidebarOpen(false);
    setError("");
    setNotice("");
  };

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const name = modalName.trim();
    if (name.length < 2 || name.length > 48) {
      setError("Choose a name between 2 and 48 characters.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_workspace", { p_name: name, p_kind: modalKind });
      if (rpcError) throw rpcError;
      const workspaceId = data as string;
      setModal(null);
      setModalName("");
      await loadData(workspaceId);
      setNotice(modalKind === "group" ? "Your private group is ready. Invite friends to bring them in." : "Your server is ready. Invite friends to build your community.");
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleCreateConversation = async (event: FormEvent<HTMLFormElement>, kind: "direct" | "group") => {
    event.preventDefault();
    if (!supabase) return;
    const names = [...new Set(usernames.split(/[\n,;]/).map((name) => name.trim().replace(/^@/, "").toLowerCase()).filter(Boolean))];
    if (kind === "direct" && names.length !== 1) {
      setError("Enter one exact SweetCord username.");
      return;
    }
    if (kind === "group" && (names.length < 2 || names.length > 8)) {
      setError("For a group DM, enter 2–8 friend usernames, separated by commas.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_dm_conversation", {
        p_kind: kind,
        p_title: kind === "group" ? (modalName.trim() || null) : null,
        p_usernames: names
      });
      if (rpcError) throw rpcError;
      setModal(null);
      setUsernames("");
      setModalName("");
      await loadData();
      openConversation(data as string);
      setNotice(kind === "group" ? "Group conversation created." : "Direct message opened.");
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleAddFriend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const username = friendUsername.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setError("Username must be 3–24 letters, numbers, or underscores.");
      return;
    }
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const { data, error: searchError } = await supabase.rpc("find_profile_by_username", { p_username: username });
      if (searchError) throw searchError;
      const target = Array.isArray(data) ? data[0] as Profile | undefined : data as Profile | null;
      if (!target) throw new Error("No SweetCord account matched that exact username.");
      if (target.id === userId) throw new Error("You can't add your own account.");
      if (friends.some((friend) => friend.id === target.id)) throw new Error("You're already friends with this person.");
      const { error: insertError } = await supabase.from("friend_requests").insert({ sender_id: userId, recipient_id: target.id, status: "pending" });
      if (insertError) {
        if (insertError.code === "23505") throw new Error("A request is already pending between these accounts.");
        throw insertError;
      }
      setFriendUsername("");
      setModal(null);
      await loadData();
      setNotice(`Friend request sent to @${target.username}.`);
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const respondToRequest = async (request: FriendRequest, status: "accepted" | "rejected") => {
    if (!supabase) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const { data, error: updateError } = await supabase.from("friend_requests").update({ status })
        .eq("id", request.id).eq("recipient_id", userId).eq("status", "pending").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("This request has already changed. Refresh and try again.");
      await loadData();
      setNotice(status === "accepted" ? "Friend request accepted. You can now open a DM." : "Friend request declined.");
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !activeWorkspaceId) return;
    const username = inviteUsername.trim().replace(/^@/, "").toLowerCase();
    setWorking(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("add_workspace_member", { p_workspace_id: activeWorkspaceId, p_username: username });
      if (rpcError) throw rpcError;
      setInviteUsername("");
      setModal(null);
      await loadData();
      setNotice("Friend added to the space.");
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleCreateChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !activeWorkspaceId) return;
    const name = modalName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9-]{2,40}$/.test(name)) {
      setError("Channel names must be 2–40 characters using lowercase letters, numbers, or hyphens.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_workspace_channel", { p_workspace_id: activeWorkspaceId, p_name: name, p_kind: channelKind });
      if (rpcError) throw rpcError;
      setModal(null);
      setModalName("");
      await loadData();
      const channelId = data as string;
      setActiveChannelId(channelId);
      setActiveConversationId(null);
      setNotice("Channel created.");
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return onSignOut();
    setWorking(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setWorking(false);
    if (signOutError) setError(readableError(signOutError));
    else onSignOut();
  };

  const selectFriendDm = async (friend: Profile) => {
    if (!supabase) return;
    setWorking(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("create_dm_conversation", { p_kind: "direct", p_title: null, p_usernames: [friend.username] });
      if (rpcError) throw rpcError;
      await loadData();
      openConversation(data as string);
    } catch (caught: unknown) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const sortedDms = useMemo(() => [...conversations].sort((a, b) => b.created_at.localeCompare(a.created_at)), [conversations]);
  const sortedFriends = useMemo(() => [...friends].sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username)), [friends]);

  const heading = activeConversation
    ? { title: conversationTitle, subtitle: activeConversation.kind === "group" ? `${activeConversationUsers.length + 1} members · Group DM` : "Direct message", icon: "dm" as const }
    : activeChannel
      ? { title: activeChannel.name, subtitle: activeWorkspace?.name || "Your server", icon: "channel" as const }
      : activeWorkspace
        ? { title: activeWorkspace.name, subtitle: activeWorkspace.kind === "group" ? "Private group space" : "Your server", icon: "workspace" as const }
        : null;

  return (
    <main className="sc-app-shell">
      <nav className="sc-rail" aria-label="Main navigation">
        <button className={`sc-rail-home ${!activeWorkspaceId && !activeConversationId ? "is-active" : ""}`} onClick={() => { setActiveWorkspaceId(null); setActiveChannelId(null); setActiveConversationId(null); setMobileSidebarOpen(false); }} aria-label="Direct messages" title="Home"><span className="sc-brand-glyph"><Headphones size={21} /></span></button>
        <span className="sc-rail-divider" />
        <div className="sc-rail-section" title="Your servers and groups">
          {workspaces.map((workspace) => (
            <button key={workspace.id} className={`sc-workspace-icon ${activeWorkspaceId === workspace.id ? "is-active" : ""} ${workspace.kind === "group" ? "is-group" : ""}`} onClick={() => openWorkspace(workspace)} title={workspace.name} aria-label={workspace.name}>
              {workspace.name.trim().slice(0, 2).toUpperCase()}
              <span className="sc-workspace-indicator" />
            </button>
          ))}
        </div>
        <button className="sc-rail-add" onClick={() => { setModalName(""); setModalKind("server"); setModal("new-workspace"); }} aria-label="Create server or group" title="Create a server or group"><Plus size={21} /></button>
        <div className="sc-rail-bottom"><button className="sc-rail-help" onClick={() => window.open("https://github.com/64r3al/SweetCord", "_blank", "noopener,noreferrer")} title="SweetCord project" aria-label="SweetCord project"><CircleHelp size={18} /></button></div>
      </nav>

      <aside className={`sc-sidepanel ${mobileSidebarOpen ? "sc-sidepanel-open" : ""}`}>
        <header className="sc-sidepanel-header">
          <a className="sc-app-wordmark" href="/" aria-label="SweetCord home"><span className="sc-wordmark-mark"><Headphones size={18} /></span><span>sweet<span>cord</span></span></a>
          <button className="sc-icon-button sc-mobile-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar"><X size={17} /></button>
        </header>

        {activeWorkspace ? (
          <>
            <div className="sc-space-heading"><div><span className="sc-overline">{activeWorkspace.kind === "group" ? "PRIVATE GROUP" : "YOUR SERVER"}</span><h2>{activeWorkspace.name}</h2></div><button className="sc-icon-button" onClick={() => setModal("invite")} aria-label="Invite a friend" title="Invite friend"><UserPlus size={17} /></button></div>
            <div className="sc-section-label"><span>TEXT CHANNELS</span>{canManageWorkspace && <button className="sc-tiny-add" onClick={() => { setModalName(""); setModal("new-channel"); }} aria-label="Create channel" title="Create channel"><Plus size={15} /></button>}</div>
            <div className="sc-channel-list">
              {activeChannels.map((channel) => <button key={channel.id} className={`sc-nav-item ${activeChannelId === channel.id ? "is-selected" : ""}`} onClick={() => openChannel(channel)}><Hash size={16} /><span>{channel.name}</span></button>)}
              {!activeChannels.length && <p className="sc-side-empty">No channels yet.</p>}
            </div>
            <div className="sc-side-spacer" />
            <button className="sc-sidebar-back" onClick={() => { setActiveWorkspaceId(null); setActiveChannelId(null); }}><ArrowLeft size={15} /> Back to messages</button>
          </>
        ) : (
          <>
            <div className="sc-sidebar-actions">
              <button className="sc-start-dm" onClick={() => { setUsernames(""); setModal("new-dm"); }}><MessageCircle size={16} /><span>New message</span><Plus size={15} /></button>
              <button className="sc-icon-button" onClick={() => void loadData()} disabled={loading} title="Refresh data" aria-label="Refresh data"><RefreshCw size={15} /></button>
            </div>
            <div className="sc-section-label"><span>DIRECT MESSAGES</span><button className="sc-tiny-add" onClick={() => { setUsernames(""); setModal("new-dm"); }} aria-label="New direct message" title="New DM"><Plus size={15} /></button></div>
            <div className="sc-dm-list">
              {sortedDms.map((conversation) => {
                const otherPeople = participants.filter((row) => row.conversation_id === conversation.id && row.user_id !== userId).map((row) => profileById.get(row.user_id)).filter((profile): profile is Profile => Boolean(profile));
                const label = conversation.kind === "group" ? conversation.title || otherPeople.map((profile) => profile.display_name || profile.username).join(", ") : otherPeople[0]?.display_name || otherPeople[0]?.username || "Direct message";
                const avatarProfile = otherPeople[0];
                return <button key={conversation.id} className={`sc-dm-item ${activeConversationId === conversation.id ? "is-selected" : ""}`} onClick={() => openConversation(conversation.id)}><Avatar profile={avatarProfile} size="small" /><span className="sc-dm-copy"><strong>{label}</strong><small>{conversation.kind === "group" ? `${otherPeople.length + 1} members` : "Direct message"}</small></span><span className="sc-dm-status" /></button>;
              })}
              {!loading && !sortedDms.length && <div className="sc-sidebar-empty"><MessageCircle size={18} /><span>Your DMs will show up here.</span></div>}
            </div>

            <button className="sc-section-label sc-friends-toggle" onClick={() => setFriendsExpanded(!friendsExpanded)}><span>FRIENDS <b>{friends.length}</b></span><ChevronDown size={14} className={friendsExpanded ? "" : "is-collapsed"} /></button>
            {friendsExpanded && <div className="sc-friends-list">
              {sortedFriends.map((friend) => <div key={friend.id} className="sc-friend-item"><Avatar profile={friend} size="small" /><span className="sc-dm-copy"><strong>{friend.display_name || friend.username}</strong><small>@{friend.username}</small></span><button className="sc-friend-message" onClick={() => void selectFriendDm(friend)} title={`Message ${friend.username}`} aria-label={`Message ${friend.username}`}><MessageCircle size={15} /></button></div>)}
              {incomingRequests.map((request) => <div className="sc-request-item" key={request.id}><Avatar profile={request.profile} size="small" /><span className="sc-dm-copy"><strong>{request.profile?.display_name || request.profile?.username || "SweetCord user"}</strong><small>Friend request</small></span><button className="sc-request-accept" disabled={working} onClick={() => void respondToRequest(request, "accepted")} title="Accept friend request" aria-label="Accept friend request"><Check size={14} /></button><button className="sc-request-decline" disabled={working} onClick={() => void respondToRequest(request, "rejected")} title="Decline friend request" aria-label="Decline friend request"><X size={14} /></button></div>)}
              {!friends.length && !incomingRequests.length && <p className="sc-side-empty">Add friends to start a conversation.</p>}
              {outgoingRequests.length > 0 && <div className="sc-outgoing-note">{outgoingRequests.length} outgoing request{outgoingRequests.length === 1 ? "" : "s"} pending</div>}
              <button className="sc-add-friend-link" onClick={() => { setFriendUsername(""); setModal("add-friend"); }}><UserPlus size={15} /> Add a friend</button>
              <button className="sc-add-friend-link" onClick={() => { setUsernames(""); setModal("new-group-dm"); }}><Users size={15} /> Start a group DM</button>
            </div>}
          </>
        )}

        <footer className="sc-account-footer">
          <Avatar profile={ownProfile} size="normal" />
          <div className="sc-account-copy"><strong>{ownProfile?.display_name || ownProfile?.username || "Your account"}</strong><span>@{ownProfile?.username || userEmail}</span></div>
          <button className="sc-icon-button" onClick={() => void handleSignOut()} disabled={working} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
        </footer>
      </aside>

      <section className="sc-chat-main">
        <header className="sc-chat-topbar">
          <button className="sc-mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="Open sidebar"><Settings2 size={18} /></button>
          <div className="sc-active-title">
            {heading?.icon === "channel" ? <Hash size={19} /> : heading?.icon === "dm" ? <MessageCircle size={19} /> : heading?.icon === "workspace" ? <Users size={18} /> : <Headphones size={19} />}
            <div><strong>{heading?.title || "Messages"}</strong><span>{heading?.subtitle || "Your squad, all in one place"}</span></div>
          </div>
          <div className="sc-topbar-right"><span className="sc-lightweight-badge"><Zap size={13} /> LIGHTWEIGHT BY DESIGN</span><button className="sc-icon-button" onClick={() => void loadData()} disabled={loading} title="Refresh" aria-label="Refresh"><RefreshCw size={15} /></button><button className="sc-icon-button" onClick={() => window.open("https://github.com/64r3al/SweetCord", "_blank", "noopener,noreferrer")} title="About SweetCord" aria-label="About SweetCord"><MoreHorizontal size={18} /></button></div>
        </header>

        {(error || notice) && <div className={`sc-banner ${error ? "sc-banner-error" : "sc-banner-info"}`} role={error ? "alert" : "status"}><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X size={15} /></button></div>}

        {activeConversationId && activeConversation ? (
          <>
            <div className="sc-message-scroll">
              <div className="sc-conversation-intro"><div className="sc-intro-icon"><MessageCircle size={25} /></div><span className="sc-overline">PRIVATE CONVERSATION</span><h1>{conversationTitle}</h1><p>{activeConversation.kind === "group" ? "A private group for your squad." : "This is the beginning of your direct message history."}</p><div className="sc-intro-rule"><span /></div></div>
              {messagesLoading && !messages.length && <div className="sc-message-empty">Loading messages…</div>}
              {messages.map((message) => <article className={`sc-message ${message.sender_id === userId ? "is-own-message" : ""}`} key={message.id}><Avatar profile={message.sender} size="normal" /><div className="sc-message-content"><div className="sc-message-meta"><strong>{message.sender_id === userId ? "You" : message.sender?.display_name || message.sender?.username || "SweetCord member"}</strong><time dateTime={message.created_at}>{timeLabel(message.created_at)}</time></div><p>{message.content}</p></div></article>)}
              {!messagesLoading && messages.length === 0 && <div className="sc-empty-chat"><Sparkles size={18} /><span>No messages yet. Say hello to get things started.</span></div>}
              <div ref={bottomRef} />
            </div>
            <form className="sc-composer" onSubmit={handleSendMessage}><div className="sc-composer-tools"><span>Message <strong>{conversationTitle}</strong></span><span>Enter to send · 4,000 character limit</span></div><div className="sc-composer-input"><textarea aria-label="Message text" value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={4000} placeholder={`Message ${conversationTitle}…`} /><button type="submit" disabled={working || !composer.trim()} aria-label="Send message" title="Send message"><Send size={17} /></button></div></form>
          </>
        ) : activeChannel ? (
          <>
            <div className="sc-message-scroll">
              <div className="sc-channel-intro"><div className="sc-intro-icon"><Hash size={25} /></div><span className="sc-overline">WELCOME TO #{activeChannel.name.toUpperCase()}</span><h1>{activeChannel.name}</h1><p>{activeChannel.topic || `This is the start of the #${activeChannel.name} channel.`}</p><div className="sc-intro-rule"><span /></div></div>
              {messagesLoading && !messages.length && <div className="sc-message-empty">Loading messages…</div>}
              {messages.map((message) => <article className={`sc-message ${message.sender_id === userId ? "is-own-message" : ""}`} key={message.id}><Avatar profile={message.sender} size="normal" /><div className="sc-message-content"><div className="sc-message-meta"><strong>{message.sender_id === userId ? "You" : message.sender?.display_name || message.sender?.username || "SweetCord member"}</strong><time dateTime={message.created_at}>{timeLabel(message.created_at)}</time></div><p>{message.content}</p></div></article>)}
              {!messagesLoading && messages.length === 0 && <div className="sc-empty-chat"><MessageCircle size={18} /><span>No messages here yet. Start the conversation.</span></div>}
              <div ref={bottomRef} />
            </div>
            <form className="sc-composer" onSubmit={handleSendMessage}><div className="sc-composer-tools"><span>Message <strong>#{activeChannel.name}</strong></span><span>Enter to send · 4,000 character limit</span></div><div className="sc-composer-input"><textarea aria-label="Message text" value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={4000} placeholder={`Message #${activeChannel.name}…`} /><button type="submit" disabled={working || !composer.trim()} aria-label="Send message" title="Send message"><Send size={17} /></button></div></form>
          </>
        ) : activeWorkspace ? (
          <div className="sc-welcome-view"><div className="sc-welcome-symbol"><Users size={28} /></div><span className="sc-overline">{activeWorkspace.kind === "group" ? "YOUR PRIVATE GROUP" : "YOUR COMMUNITY"}</span><h1>Welcome to {activeWorkspace.name}.</h1><p>{activeWorkspace.kind === "group" ? "A smaller space for your people." : "Set up channels and bring your squad together."} Select a channel to start talking.</p><div className="sc-quick-actions">{canManageWorkspace && <button className="sc-primary-button" onClick={() => { setModalName(""); setModal("new-channel"); }}><Plus size={16} /> Create a channel</button>}<button className="sc-secondary-button" onClick={() => setModal("invite")}><UserPlus size={16} /> Invite a friend</button></div></div>
        ) : (
          <div className="sc-welcome-view sc-home-welcome"><div className="sc-welcome-symbol"><Headphones size={29} /></div><span className="sc-overline">A LITTLE LESS NOISE</span><h1>Your squad.<br /><span>Your game.</span></h1><p>Lightweight conversations for people who just want to play together. No bloated feed. No subscription wall for core features.</p><div className="sc-home-cards"><button className="sc-home-card" onClick={() => { setUsernames(""); setModal("new-dm"); }}><span className="sc-home-card-icon"><MessageCircle size={18} /></span><strong>Start a DM</strong><small>Jump straight into a private chat with a friend.</small><ArrowRight size={16} /></button><button className="sc-home-card" onClick={() => { setModalName(""); setModalKind("server"); setModal("new-workspace"); }}><span className="sc-home-card-icon"><Compass size={18} /></span><strong>Create a server</strong><small>Make a space for your team, game, or community.</small><ArrowRight size={16} /></button><button className="sc-home-card" onClick={() => { setModalName(""); setModalKind("group"); setModal("new-workspace"); }}><span className="sc-home-card-icon"><Users size={18} /></span><strong>Create a group</strong><small>A private space for your closest squadmates.</small><ArrowRight size={16} /></button></div><div className="sc-capability-row"><span><Zap size={14} /> Low overhead is the goal</span><span><ShieldCheck size={14} /> Private by default</span><span><Activity size={14} /> Built for gamers</span></div>{loading && <span className="sc-loading-caption">Syncing your account…</span>}</div>
        )}
        <footer className="sc-chat-footer"><span><span className="sc-footer-dot" /> Connected to SweetCord</span><span>Early access · Built for the community</span></footer>
      </section>

      {modal && <div className="sc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="sc-modal-title"><button className="sc-modal-close" onClick={() => setModal(null)} aria-label="Close dialog"><X size={17} /></button>
        {modal === "new-workspace" && <><span className="sc-modal-symbol">{modalKind === "group" ? <Users size={22} /> : <Compass size={22} />}</span><span className="sc-overline">MAKE IT YOURS</span><h2 id="sc-modal-title">{modalKind === "group" ? "Create a private group" : "Create a server"}</h2><p>{modalKind === "group" ? "A private place for your people to chat together." : "A home for your team, community, or gaming crew."}</p><div className="sc-modal-choice"><button type="button" className={modalKind === "server" ? "is-selected" : ""} onClick={() => setModalKind("server")}><Compass size={16} /><span><strong>Server</strong><small>Community space with channels</small></span></button><button type="button" className={modalKind === "group" ? "is-selected" : ""} onClick={() => setModalKind("group")}><Users size={16} /><span><strong>Private group</strong><small>Smaller space for a squad</small></span></button></div><form onSubmit={handleCreateWorkspace}><label htmlFor="sc-workspace-name">Name</label><input id="sc-workspace-name" autoFocus minLength={2} maxLength={48} value={modalName} onChange={(event) => setModalName(event.target.value)} placeholder={modalKind === "group" ? "Weekend squad" : "Your gaming community"} required /><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working}>{working ? "Creating…" : "Create space"} <ArrowRight size={16} /></button></form></>}
        {modal === "new-dm" && <><span className="sc-modal-symbol"><MessageCircle size={22} /></span><span className="sc-overline">ONE-TO-ONE CHAT</span><h2 id="sc-modal-title">Start a direct message</h2><p>Enter your friend's exact SweetCord username. You both need to be friends first.</p><form onSubmit={(event) => void handleCreateConversation(event, "direct")}><label htmlFor="sc-dm-user">SweetCord username</label><div className="sc-modal-input-icon"><AtSign size={16} /><input id="sc-dm-user" autoFocus maxLength={25} value={usernames} onChange={(event) => setUsernames(event.target.value.replace(/[\n,;]/g, ""))} placeholder="player_one" required /></div><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working || !usernames.trim()}>{working ? "Opening…" : "Open conversation"} <ArrowRight size={16} /></button></form></>}
        {modal === "new-group-dm" && <><span className="sc-modal-symbol"><Users size={22} /></span><span className="sc-overline">SQUAD CHAT</span><h2 id="sc-modal-title">Start a group DM</h2><p>Choose 2–8 friends. Enter their exact SweetCord usernames separated by commas.</p><form onSubmit={(event) => void handleCreateConversation(event, "group")}><label htmlFor="sc-group-name">Group name <small>Optional</small></label><input id="sc-group-name" maxLength={48} value={modalName} onChange={(event) => setModalName(event.target.value)} placeholder="Friday night squad" /><label htmlFor="sc-group-users">Friend usernames</label><textarea id="sc-group-users" autoFocus rows={3} value={usernames} onChange={(event) => setUsernames(event.target.value)} placeholder="player_one, player_two" required /><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working || !usernames.trim()}>{working ? "Creating…" : "Create group DM"} <ArrowRight size={16} /></button></form></>}
        {modal === "add-friend" && <><span className="sc-modal-symbol"><UserPlus size={22} /></span><span className="sc-overline">FIND YOUR PEOPLE</span><h2 id="sc-modal-title">Add a friend</h2><p>Search by exact SweetCord username. Email addresses stay private.</p><form onSubmit={handleAddFriend}><label htmlFor="sc-friend-user">SweetCord username</label><div className="sc-modal-input-icon"><AtSign size={16} /><input id="sc-friend-user" autoFocus maxLength={25} value={friendUsername} onChange={(event) => setFriendUsername(event.target.value)} placeholder="their_username" required /></div><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working || !friendUsername.trim()}>{working ? "Sending…" : "Send friend request"} <ArrowRight size={16} /></button></form></>}
        {modal === "new-channel" && <><span className="sc-modal-symbol"><Hash size={22} /></span><span className="sc-overline">ORGANIZE THE CONVERSATION</span><h2 id="sc-modal-title">Create a channel</h2><p>Add a focused place to talk about a game, a team, or whatever your squad needs.</p><form onSubmit={handleCreateChannel}><label htmlFor="sc-channel-name">Channel name</label><div className="sc-modal-input-icon"><Hash size={16} /><input id="sc-channel-name" autoFocus maxLength={40} value={modalName} onChange={(event) => setModalName(event.target.value)} placeholder="clips-and-highlights" required /></div><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working || !modalName.trim()}>{working ? "Creating…" : "Create channel"} <ArrowRight size={16} /></button></form></>}
        {modal === "invite" && <><span className="sc-modal-symbol"><UserPlus size={22} /></span><span className="sc-overline">GROW YOUR SQUAD</span><h2 id="sc-modal-title">Invite a friend</h2><p>{activeWorkspace?.kind === "group" ? "Add a friend to this private group." : "Add a friend to your server."} They must already be on your SweetCord friends list.</p><form onSubmit={handleInvite}><label htmlFor="sc-invite-user">SweetCord username</label><div className="sc-modal-input-icon"><AtSign size={16} /><input id="sc-invite-user" autoFocus maxLength={25} value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} placeholder="friend_username" required /></div><button className="sc-primary-button sc-modal-submit" type="submit" disabled={working || !inviteUsername.trim() || !activeWorkspaceId}>{working ? "Inviting…" : "Add to space"} <ArrowRight size={16} /></button></form></>}
      </section></div>}
    </main>
  );
}
