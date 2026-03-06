import React, { useEffect, useState, useCallback } from 'react';
import Avatar from '../ui/Avatar';
import { formatShort } from '../../utils/timeFormat';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function ConversationList({ activeId, onSelect }) {
  const { user, logout } = useAuth();
  const { connected, on } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load conversations on mount
  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Real-time: update last message preview in list
  useEffect(() => {
    const unsub = on('message:new', (msg) => {
      setConversations((prev) =>
        prev
          .map((c) => {
            if (c._id === msg.conversationId) {
              return {
                ...c,
                lastMessage: { content: msg.content, sender: msg.sender, createdAt: msg.createdAt },
                updatedAt: msg.createdAt,
              };
            }
            return c;
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
    });
    return unsub;
  }, [on]);

  // Real-time: update online presence in conversation list
  useEffect(() => {
    const unsub = on('user:online', ({ userId, isOnline, lastSeen }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === userId ? { ...p, isOnline, lastSeen: lastSeen || p.lastSeen } : p
          ),
        }))
      );
    });
    return unsub;
  }, [on]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.users);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const startConversation = async (userId) => {
    try {
      const res = await api.post('/conversations', { userId });
      const conv = res.data.conversation;
      setSearchQuery('');
      setSearchResults([]);
      if (!conversations.find((c) => c._id === conv._id)) {
        setConversations((prev) => [conv, ...prev]);
      }
      onSelect(conv);
    } catch (err) { console.error(err); }
  };

  const getOtherUser = (conv) => conv.participants?.find((p) => p._id !== user?._id);

  const getLastMessagePreview = (conv) => {
    const msg = conv.lastMessage;
    if (!msg) return 'No messages yet';
    const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
    const preview = msg.content?.length > 38 ? msg.content.slice(0, 38) + '…' : msg.content;
    return isMe ? `You: ${preview}` : preview;
  };

  return (
    <div className="flex flex-col h-full bg-base-200 border-r border-base-300">

      {/* Header */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-bold text-lg">ChatFlow</span>
            <div className={`badge badge-xs ${connected ? 'badge-success' : 'badge-error'}`} title={connected ? 'Connected' : 'Reconnecting'} />
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} className="cursor-pointer">
              <Avatar user={user} size="sm" />
            </div>
            <ul tabIndex={0} className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-48 mt-2">
              <li className="menu-title text-xs opacity-50 px-2">{user?.username}</li>
              <li><button onClick={logout} className="text-error text-sm">Sign Out</button></li>
            </ul>
          </div>
        </div>

        {/* Search box + results dropdown */}
        <div className="relative">
          <input
            type="text"
            className="input input-sm input-bordered w-full pl-8 text-sm"
            placeholder="Search users to chat…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* Search results dropdown */}
          {searchQuery.length >= 2 && (
            <div className="absolute left-0 right-0 z-20 bg-base-100 border border-base-300 rounded-xl shadow-xl mt-1 overflow-hidden">
              {searching ? (
                <div className="p-3 text-center text-sm text-base-content/50">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-sm text-base-content/50">No users found</div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u._id} onClick={() => startConversation(u._id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-base-200 transition-colors text-left"
                  >
                    <Avatar user={u} size="sm" showStatus />
                    <div>
                      <div className="font-medium text-sm">{u.username}</div>
                      <div className="text-xs text-base-content/40">{u.isOnline ? 'Online' : 'Offline'}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="loading loading-spinner loading-sm text-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-base-content/30 p-4 text-center">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No conversations yet.<br />Search for a user to start chatting!</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const other = getOtherUser(conv);
            const isActive = conv._id === activeId;
            return (
              <button
                key={conv._id} onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-base-300 transition-colors text-left border-b border-base-300/40 ${isActive ? 'bg-base-300' : ''}`}
              >
                <Avatar user={other} size="md" showStatus />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{other?.username || 'Unknown'}</span>
                    {conv.lastMessage?.createdAt && (
                      <span className="text-xs text-base-content/40 shrink-0 ml-1">
                        {formatShort(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-base-content/50 truncate">{getLastMessagePreview(conv)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
