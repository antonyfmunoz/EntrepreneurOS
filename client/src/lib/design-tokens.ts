/**
 * Design Tokens — EntrepreneurOS
 * 
 * Central source of truth for all design values.
 * These values are exported as CSS variables and TypeScript constants.
 */

export const colors = {
  primary: '#6a37d4',
  primaryHover: '#5a2dc0',
  secondary: '#6448b2',
  tertiary: '#ae8dff',
  surface: '#f5f6f7',
  background: '#ffffff',
  onSurface: '#2c2f30',
  onSurfaceVariant: '#595c5d',
  outlineVariant: '#abadae',
  surfaceContainerLow: '#eff1f2',
} as const;

export const glassmorphism = {
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(16px)',
  shadow: '0 8px 32px rgba(106,55,212,0.08)',
} as const;

export const shadows = {
  ambient: '0 8px 32px rgba(106,55,212,0.08)',
  none: 'none',
} as const;

export const borderRadius = {
  default: '12px',
  sm: '8px',
  lg: '16px',
  full: '9999px',
} as const;

export const spacing = {
  cardPadding: '32px',
  cardPaddingMobile: '20px',
  sectionGap: '24px',
  elementGap: '16px',
  compactGap: '12px',
  tightGap: '8px',
} as const;

export const typography = {
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const breakpoints = {
  mobile: '375px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
} as const;

export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  popover: 40,
  tooltip: 50,
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type TypographyFontSize = keyof typeof typography.fontSize;
export type TypographyFontWeight = keyof typeof typography.fontWeight;

export const getCSSVariables = (): Record<string, string> => {
  return {
    '--color-primary': colors.primary,
    '--color-primary-hover': colors.primaryHover,
    '--color-secondary': colors.secondary,
    '--color-tertiary': colors.tertiary,
    '--color-surface': colors.surface,
    '--color-background': colors.background,
    '--color-on-surface': colors.onSurface,
    '--color-on-surface-variant': colors.onSurfaceVariant,
    '--color-outline-variant': colors.outlineVariant,
    '--color-surface-container-low': colors.surfaceContainerLow,
    
    '--glass-background': glassmorphism.background,
    '--glass-backdrop-filter': glassmorphism.backdropFilter,
    '--glass-shadow': glassmorphism.shadow,
    
    '--shadow-ambient': shadows.ambient,
    
    '--border-radius': borderRadius.default,
    '--border-radius-sm': borderRadius.sm,
    '--border-radius-lg': borderRadius.lg,
    '--border-radius-full': borderRadius.full,
    
    '--spacing-card-padding': spacing.cardPadding,
    '--spacing-section-gap': spacing.sectionGap,
    '--spacing-element-gap': spacing.elementGap,
    
    '--font-family': typography.fontFamily,
    '--font-size-base': typography.fontSize.base,
    
    '--animation-duration': animation.duration.normal,
    '--animation-easing': animation.easing.default,
  };
};

export const applyGlassmorphism = (additionalStyles?: Record<string, string | number>): React.CSSProperties => {
  return {
    background: glassmorphism.background,
    backdropFilter: glassmorphism.backdropFilter,
    WebkitBackdropFilter: glassmorphism.backdropFilter,
    boxShadow: glassmorphism.shadow,
    ...additionalStyles,
  };
};

export const applyAmbientShadow = (): React.CSSProperties => {
  return {
    boxShadow: shadows.ambient,
  };
};

const designTokens = {
  colors,
  glassmorphism,
  shadows,
  borderRadius,
  spacing,
  typography,
  breakpoints,
  zIndex,
  animation,
  getCSSVariables,
  applyGlassmorphism,
  applyAmbientShadow,
};

export default designTokens;