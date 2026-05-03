import React from 'react';
import AxisBar from './AxisBar';
import { COLORS } from '../theme';

const AXES = [
  { left: 'Racines', right: 'Horizons', key: 'racinesHorizons' },
  { left: 'Taniere', right: 'Nomade', key: 'taniereNomade' },
  { left: 'Exigeant', right: 'Enthousiaste', key: 'exigeantEnthousiaste' },
  { left: 'Foule', right: 'Secret', key: 'fouleSecret' },
  { left: 'Gargote', right: 'Table', key: 'gargoteTable' },
];

export default function PalaisRadar({ palais = {}, dark = false }) {
  const containerStyle = {
    padding: '16px 0',
  };

  const titleStyle = {
    fontFamily: 'var(--display, "DM Serif Text", serif)',
    fontSize: 18,
    color: dark ? COLORS.white : COLORS.warmBlack,
    marginBottom: 16,
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Ton Palais</div>
      {AXES.map(({ left, right, key }) => (
        <AxisBar
          key={key}
          left={left}
          right={right}
          value={palais[key] ?? 0}
          dark={dark}
        />
      ))}
    </div>
  );
}
