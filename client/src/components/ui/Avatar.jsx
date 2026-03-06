import React from 'react';

const COLORS = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-info', 'bg-success', 'bg-warning', 'bg-error'];

function getColor(username = '') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ user, size = 'md', showStatus = false, className = '' }) {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };
  const statusSizes = { xs: 'w-1.5 h-1.5', sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3', xl: 'w-3.5 h-3.5' };
  const color = getColor(user?.username);
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold text-white`}>
        {user?.avatar
          ? <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
          : initials}
      </div>
      {showStatus && (
        <span className={`absolute bottom-0 right-0 ${statusSizes[size]} rounded-full border-2 border-base-200 ${user?.isOnline ? 'bg-success' : 'bg-base-content/20'}`} />
      )}
    </div>
  );
}
