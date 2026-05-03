import React from 'react';
import { COLORS } from '../theme';

function BadgeItem({ badge }) {
  const { name = '', icon = '', dateEarned } = badge;

  const itemStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  };

  const circleStyle = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${COLORS.goldGlow}, ${COLORS.grey50})`,
    border: `2px solid ${COLORS.gold}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    boxShadow: `0 2px 8px ${COLORS.goldGlow}`,
  };

  const nameStyle = {
    fontFamily: 'var(--body, "Manrope", sans-serif)',
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.grey600,
    textAlign: 'center',
    lineHeight: 1.25,
    maxWidth: 72,
    wordBreak: 'break-word',
  };

  const dateStyle = {
    fontFamily: 'var(--body, "Manrope", sans-serif)',
    fontSize: 9,
    color: COLORS.grey300,
    textAlign: 'center',
  };

  return (
    <div style={itemStyle}>
      <div style={circleStyle}>
        <span role="img" aria-label={name}>
          {icon}
        </span>
      </div>
      <span style={nameStyle}>{name}</span>
      {dateEarned && <span style={dateStyle}>{dateEarned}</span>}
    </div>
  );
}

export default function BadgeGrid({ badges = [] }) {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: 20,
    padding: '8px 0',
    justifyItems: 'center',
  };

  const emptyStyle = {
    fontFamily: 'var(--body, "Manrope", sans-serif)',
    fontSize: 13,
    color: COLORS.grey300,
    textAlign: 'center',
    padding: '24px 0',
    fontStyle: 'italic',
  };

  if (badges.length === 0) {
    return <div style={emptyStyle}>Pas encore de badges</div>;
  }

  return (
    <div style={gridStyle}>
      {badges.map((badge) => (
        <BadgeItem key={badge.id} badge={badge} />
      ))}
    </div>
  );
}
