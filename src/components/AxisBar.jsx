import React from 'react';
import { COLORS } from '../theme';

export default function AxisBar({ left, right, value = 0, dark = false }) {
  const normalized = Math.max(0, Math.min(1, (value + 50) / 100));

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  };

  const labelStyle = {
    fontFamily: 'var(--body, "Manrope", sans-serif)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: dark ? COLORS.grey300 : COLORS.grey500,
    minWidth: 72,
    textAlign: 'center',
    lineHeight: 1.2,
  };

  const leftLabelStyle = {
    ...labelStyle,
    textAlign: 'right',
  };

  const rightLabelStyle = {
    ...labelStyle,
    textAlign: 'left',
  };

  const trackStyle = {
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: dark ? COLORS.grey600 : COLORS.grey100,
    position: 'relative',
    overflow: 'visible',
  };

  const centerLineStyle = {
    position: 'absolute',
    left: '50%',
    top: -2,
    width: 1,
    height: 10,
    background: dark ? COLORS.grey400 : COLORS.grey200,
    transform: 'translateX(-0.5px)',
  };

  const isLeft = normalized < 0.5;
  const fillLeft = isLeft ? `${normalized * 100}%` : '50%';
  const fillWidth = isLeft
    ? `${(0.5 - normalized) * 100}%`
    : `${(normalized - 0.5) * 100}%`;

  const fillStyle = {
    position: 'absolute',
    top: 0,
    left: fillLeft,
    width: fillWidth,
    height: '100%',
    borderRadius: 3,
    background: `linear-gradient(${isLeft ? '270deg' : '90deg'}, ${COLORS.gold}, rgba(200,164,78,0.15))`,
    transition: 'width 0.4s ease, left 0.4s ease',
  };

  const dotSize = 12;
  const dotStyle = {
    position: 'absolute',
    top: '50%',
    left: `${normalized * 100}%`,
    width: dotSize,
    height: dotSize,
    borderRadius: '50%',
    background: COLORS.gold,
    border: `2px solid ${dark ? COLORS.warmBlack : COLORS.white}`,
    transform: 'translate(-50%, -50%)',
    boxShadow: `0 1px 4px rgba(0,0,0,0.15)`,
    transition: 'left 0.4s ease',
    zIndex: 2,
  };

  return (
    <div style={containerStyle}>
      <span style={leftLabelStyle}>{left}</span>
      <div style={trackStyle}>
        <div style={centerLineStyle} />
        <div style={fillStyle} />
        <div style={dotStyle} />
      </div>
      <span style={rightLabelStyle}>{right}</span>
    </div>
  );
}
