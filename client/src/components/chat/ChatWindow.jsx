import React, { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from '../ui/Avatar';
import { formatTime, formatDateDivider } from '../../utils/timeFormat';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function ChatWindow({ conversation }) {
  const { user } = useAuth();
  const { on, emit, joinConversation } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const convId = conversation._id;
  const otherUser = conversation.participants?.find((p) => p._id !== user?._id);

  // Load messages for this conversation
  const loadMessages = useCallback(async (pg = 1, prepend = false) => {
    try {
      const res = await api.get(`/conversations/${convId}/messages?page=${pg}&limit=30`);
      const { messages: msgs, pagination } = res.data;
      setMessages((prev) => (prepend ? [...msgs, ...prev] : msgs));
      setHasMore(pg < pagination.pages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [convId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setTypingUsers(new Set());
    joinConversation(convId);
    loadMessages(1, false);
    emit('message:read', { conversationId: convId });
  }, [convId, loadMessages, joinConversation, emit]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Real-time: incoming new messages
  useEffect(() => {
    const unsub = on('message:new', (msg) => {
      if (msg.conversationId === convId) {
        setMessages((prev) => [...prev, msg]);
        emit('message:read', { conversationId: convId });
      }
    });
    return unsub;
  }, [on, convId, emit]);

  // Real-time: typing indicators
  useEffect(() => {
    const unsubStart = on('typing:start', ({ userId, conversationId }) => {
      if (conversationId === convId && userId !== user?._id) {
        setTypingUsers((prev) => new Set([...prev, userId]));
      }
    });
    const unsubStop = on('typing:stop', ({ userId, conversationId }) => {
      if (conversationId === convId) {
        setTypingUsers((prev) => { const n = new Set(prev); n.delete(userId); return n; });
      }
    });
    return () => { unsubStart(); unsubStop(); };
  }, [on, convId, user?._id]);

  const handleTyping = () => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing:start', { conversationId: convId });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing:stop', { conversationId: convId });
    }, 1500);
  };

  const sendMessage = useCallback((e) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    emit('typing:stop', { conversationId: convId });
    setInput('');
    setSending(true);

    // Safety timeout — reset sending if callback never fires (e.g. socket disconnected)
    const sendTimeout = setTimeout(() => setSending(false), 5000);

    emit('message:send', { conversationId: convId, content }, (res) => {
      clearTimeout(sendTimeout);
      if (!res?.success) console.error('Send failed:', res?.error);
      setSending(false);
    });
  }, [input, sending, emit, convId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await loadMessages(nextPage, true);
  };

  // Group messages by calendar date for date dividers
  const grouped = messages.reduce((acc, msg) => {
    const day = new Date(msg.createdAt).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-base-100">

      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-base-300 bg-base-200 shrink-0">
        <Avatar user={otherUser} size="md" showStatus />
        <div>
          <div className="font-semibold text-base">{otherUser?.username || 'Unknown'}</div>
          <div className="text-xs text-base-content/50">
            {otherUser?.isOnline ? (
              <span className="text-success">● Online</span>
            ) : (
              'Offline'
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : (
          <>
            {/* Load older messages */}
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button className="btn btn-xs btn-ghost" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore
                    ? <span className="loading loading-spinner loading-xs" />
                    : 'Load older messages'}
                </button>
              </div>
            )}

            {/* Messages grouped by date */}
            {Object.entries(grouped).map(([day, dayMessages]) => (
              <div key={day}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-base-300" />
                  <span className="text-xs text-base-content/40 font-medium whitespace-nowrap">
                    {formatDateDivider(dayMessages[0].createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-base-300" />
                </div>

                {dayMessages.map((msg, i) => {
                  const isMe = msg.sender?._id === user?._id;
                  const showAvatar = !isMe && (i === 0 || dayMessages[i - 1]?.sender?._id !== msg.sender?._id);

                  return (
                    <div key={msg._id} className={`flex gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
                      {/* Avatar column */}
                      <div className="w-8 shrink-0 flex items-end">
                        {!isMe && showAvatar && <Avatar user={msg.sender} size="sm" />}
                      </div>

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                          isMe
                            ? 'bg-primary text-primary-content rounded-tr-sm'
                            : 'bg-base-200 text-base-content rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-base-content/30 mt-0.5 px-1">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div className="flex gap-2 items-center mt-1 animate-fade-in">
                <div className="w-8" />
                <div className="bg-base-200 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-pulse-dot" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-pulse-dot" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Message input */}
      <div className="p-3 border-t border-base-300 bg-base-200 shrink-0">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            type="text"
            className="input input-bordered flex-1 text-sm h-10"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
            maxLength={2000}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary btn-square h-10 w-10 min-h-0"
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-xs text-base-content/20 mt-1 pl-1">{input.length}/2000</p>
      </div>
    </div>
  );
}
