type Props = { size?: number; color?: string };

export function Logo({ size = 28, color = '#3182f6' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="7" fill={color} />
      <path
        d="M8 19.5 L11.5 11 H20.5 L24 19.5 H21.2 L20.5 17.6 H11.5 L10.8 19.5 H8 Z M12.4 15.2 H19.6 L18.4 12.5 H13.6 L12.4 15.2 Z M10 22 H12 V24 H10 Z M20 22 H22 V24 H20 Z"
        fill="white"
      />
    </svg>
  );
}
