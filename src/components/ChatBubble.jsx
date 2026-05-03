import React from 'react';
import { COLORS } from '../theme';

const keyframesInjected = (() => {
  if (typeof document === 'undefined') return false;
  const id = 'chatbubble-fadeup';
  if (document.getElementById(id)) return true;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @keyframes chatBubbleFadeUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
  return true;
})();

export default function ChatBubble({ text, delay = 0 }) {
  const containerStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    opacity: 0,
    animation: 'chatBubbleFadeUp 0.5s ease forwards',
    animationDelay: `${delay}ms`,
    marginBottom: 12,
  };

  const avatarStyle = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: COLORS.black,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: `0 0 0 3px ${COLORS.goldGlow}`,
  };

  const eyeStyle = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: COLORS.white,
    position: 'relative',
  };

  const pupilStyle = {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: COLORS.gold,
    position: 'absolute',
    top: 3,
    left: 3,
  };

  const bubbleStyle = {
    background: COLORS.grey50,
    border: `1px solid ${COLORS.grey100}`,
    borderRadius: '0 16px 16px 16px',
    padding: '12px 16px',
    maxWidth: '80%',
    fontFamily: 'var(--body, "Manrope", sans-serif)',
    fontSize: 14,
    lineHeight: 1.5,
    fontStyle: 'italic',
    color: COLORS.grey600,
  };

  return (
    <div style={containerStyle}>
      <div style={avatarStyle}>
        <div style={eyeStyle}>
          <div style={pupilStyle} />
        </div>
      </div>
      <div style={bubbleStyle}>{text}</div>
    </div>
  );
}
