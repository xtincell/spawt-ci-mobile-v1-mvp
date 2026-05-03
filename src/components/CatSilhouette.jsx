import React from 'react';
import { COLORS } from '../theme';

const CAT_PATH =
  'M12 2C9.5 2 7.5 3 6 5C5 4 3.5 3.5 3 4C2.5 4.5 3 6 4 7C2.5 9 2 11 2 13C2 17.5 6.5 21 12 21C17.5 21 22 17.5 22 13C22 11 21.5 9 20 7C21 6 21.5 4.5 21 4C20.5 3.5 19 4 18 5C16.5 3 14.5 2 12 2ZM8.5 12C9.33 12 10 12.67 10 13.5C10 14.33 9.33 15 8.5 15C7.67 15 7 14.33 7 13.5C7 12.67 7.67 12 8.5 12ZM15.5 12C16.33 12 17 12.67 17 13.5C17 14.33 16.33 15 15.5 15C14.67 15 14 14.33 14 13.5C14 12.67 14.67 12 15.5 12ZM12 17C10.5 17 9.5 16.5 9.5 16.5C9.5 16.5 10.5 17.5 12 17.5C13.5 17.5 14.5 16.5 14.5 16.5C14.5 16.5 13.5 17 12 17Z';

export default function CatSilhouette({
  size = 24,
  color = COLORS.gold,
  style = {},
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', ...style }}
    >
      <path d={CAT_PATH} fill={color} />
    </svg>
  );
}
