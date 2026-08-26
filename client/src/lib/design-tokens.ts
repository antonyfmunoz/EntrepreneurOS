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
  ambientHover: '0 12px 40px rgba(106,55,212,0.12)',
} as const;

export const borderRadius = {
  default: '12px',
  sm: '8px',
  lg: '16px',
} as const;

export const spacing = {
  cardPadding: '32px',
  cardPaddingMobile: '20px',
  navItemPadding: '12px 16px',
  sectionGap: '24px',
} as const;

export const typography = {
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
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
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  toast: 1400,
} as const;

export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type Colors = typeof colors;
export type Glassmorphism = typeof glassmorphism;
export type Shadows = typeof shadows;
export type BorderRadius = typeof borderRadius;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type Breakpoints = typeof breakpoints;
export type ZIndex = typeof zIndex;
export type Transition = typeof transition;

export interface DesignTokens {
  colors: Colors;
  glassmorphism: Glassmorphism;
  shadows: Shadows;
  borderRadius: BorderRadius;
  spacing: Spacing;
  typography: Typography;
  breakpoints: Breakpoints;
  zIndex: ZIndex;
  transition: Transition;
}

const designTokens: DesignTokens = {
  colors,
  glassmorphism,
  shadows,
  borderRadius,
  spacing,
  typography,
  breakpoints,
  zIndex,
  transition,
};

export default designTokens;

export function getCSSVariables(): string {
  return `
    --color-primary: ${colors.primary};
    --color-primary-hover: ${colors.primaryHover};
    --color-secondary: ${colors.secondary};
    --color-tertiary: ${colors.tertiary};
    --color-surface: ${colors.surface};
    --color-background: ${colors.background};
    --color-on-surface: ${colors.onSurface};
    --color-on-surface-variant: ${colors.onSurfaceVariant};
    --color-outline-variant: ${colors.outlineVariant};
    --color-surface-container-low: ${colors.surfaceContainerLow};
    
    --glass-background: ${glassmorphism.background};
    --glass-backdrop-filter: ${glassmorphism.backdropFilter};
    --glass-shadow: ${glassmorphism.shadow};
    
    --shadow-ambient: ${shadows.ambient};
    --shadow-ambient-hover: ${shadows.ambientHover};
    
    --border-radius: ${borderRadius.default};
    --border-radius-sm: ${borderRadius.sm};
    --border-radius-lg: ${borderRadius.lg};
    
    --spacing-card-padding: ${spacing.cardPadding};
    --spacing-card-padding-mobile: ${spacing.cardPaddingMobile};
    --spacing-section-gap: ${spacing.sectionGap};
    
    --font-family: ${typography.fontFamily};
    
    --transition-fast: ${transition.fast};
    --transition-normal: ${transition.normal};
    --transition-slow: ${transition.slow};
  `.trim();
}

export function applyDesignTokensToRoot(): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const cssVars = getCSSVariables();
    const vars = cssVars.split('\n').map(v => v.trim()).filter(Boolean);
    
    vars.forEach(varDeclaration => {
      const [name, value] = varDeclaration.split(':').map(s => s.trim());
      if (name && value) {
        root.style.setProperty(name, value.replace(';', ''));
      }
    });
  }
}
