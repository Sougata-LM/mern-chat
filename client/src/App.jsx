import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './components/auth/AuthPage';
import ConversationList from './components/chat/ConversationList';
import ChatWindow from './components/chat/ChatWindow';

export default function App() {
  const { user, loading } = useAuth();
  const [activeConversation, setActiveConversation] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/40 text-sm">Loading ChatFlow…</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="h-screen flex overflow-hidden bg-base-100">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col relative">
        <ConversationList
          activeId={activeConversation?._id}
          onSelect={setActiveConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeConversation ? (
          <ChatWindow key={activeConversation._id} conversation={activeConversation} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-base-100 gap-4 text-base-content/30">
            <div className="w-20 h-20 bg-base-200 rounded-3xl flex items-center justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-base-content/50">Welcome, {user.username}!</p>
              <p className="text-sm mt-1">Search for a user to start a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
