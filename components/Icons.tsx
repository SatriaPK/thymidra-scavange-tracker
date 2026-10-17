import type { ReactNode } from 'react';

// Material Design icons (Google Material Icons, 24px filled, Apache 2.0).
function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

const icon = (d: string, size?: number) => () => (
  <Svg size={size}>
    <path d={d} />
  </Svg>
);

export const MenuIcon = icon('M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z');
export const PlusIcon = icon('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z');
export const UploadIcon = icon('M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z');
export const DownloadIcon = icon('M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
export const SearchIcon = icon(
  'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 12 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 12 14 9.5 14z',
  22,
);
export const PencilIcon = icon(
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  22,
);
export const TrashIcon = icon('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z', 22);
export const ChevronLeftIcon = icon('M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z', 22);
export const ArrowRightIcon = icon('M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z', 22);
export const GearIcon = icon(
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  22,
);
export const CloseIcon = icon('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
