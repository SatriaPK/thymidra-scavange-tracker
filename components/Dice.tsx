/** Bentuk dadu sederhana dengan sisi dan hasil yang dapat ditentukan. */
export function Dice({ value, sides = 20, className = '' }: { value: number | string; sides?: 4 | 20; className?: string }) {
  return (
    <svg className={`dice ${className}`} viewBox="0 0 100 100" role="img" aria-label={`d${sides}: ${value}`}>
      {sides === 4 ? (
        <>
          <polygon points="50,6 94,88 6,88" fill="var(--paper)" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
          <path d="M50 6 50 88M50 55 6 88M50 55 94 88" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
        </>
      ) : (
        <>
          <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="var(--paper)" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter" />
          <polygon points="50,18 78,64 22,64" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
        </>
      )}
      <text x="50" y={sides === 4 ? '70' : '58'} textAnchor="middle" fontSize="30" fontWeight="600" fill="currentColor">{value}</text>
    </svg>
  );
}
