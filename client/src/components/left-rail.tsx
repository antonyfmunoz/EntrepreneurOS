import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import designTokens from '@/lib/design-tokens';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  href: string;
  badge?: number;
  children?: NavItem[];
}

export interface LeftRailProps {
  items?: NavItem[];
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  onNavigate?: () => void;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  items = [],
  className,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  footer,
  header,
  onNavigate,
}) => {
  const [location] = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  const handleCollapsedToggle = () => {
    const newValue = !isCollapsed;
    setInternalCollapsed(newValue);
    onCollapsedChange?.(newValue);
  };

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleItemExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const isItemActive = (href: string): boolean => {
    if (href === '/') {
      return location === '/';
    }
    return location.startsWith(href);
  };

  const hasActiveChild = (item: NavItem): boolean => {
    if (!item.children || item.children.length === 0) {
      return false;
    }
    return item.children.some((child) => isItemActive(child.href));
  };

  const renderNavItem = (item: NavItem, depth: number = 0) => {
    const Icon = item.icon;
    const active = isItemActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const childActive = hasActiveChild(item);

    const itemContent = (
      <div
        className={cn(
          'group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
          'hover:bg-white/60',
          active && 'bg-white shadow-sm',
          depth > 0 && 'ml-6',
          isCollapsed && depth === 0 && 'justify-center px-3'
        )}
        style={{
          fontFamily: designTokens.typography.fontFamily,
        }}
      >
        <Icon
          className={cn(
            'flex-shrink-0 transition-colors',
            active ? 'text-[#6a37d4]' : 'text-[#595c5d]',
            'group-hover:text-[#6a37d4]'
          )}
          size={20}
        />
        {!isCollapsed && (
          <>
            <span
              className={cn(
                'flex-1 text-sm font-medium transition-colors',
                active ? 'text-[#2c2f30]' : 'text-[#595c5d]',
                'group-hover:text-[#2c2f30]'
              )}
            >
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: designTokens.colors.primary }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'flex-shrink-0 text-[#595c5d] transition-transform',
                  isExpanded && 'rotate-90'
                )}
                size={16}
              />
            )}
          </>
        )}
        {active && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
            style={{ backgroundColor: designTokens.colors.primary }}
          />
        )}
      </div>
    );

    return (
      <div key={item.id}>
        {hasChildren ? (
          <button
            onClick={() => handleItemExpand(item.id)}
            className="w-full text-left"
            aria-expanded={isExpanded}
          >
            {itemContent}
          </button>
        ) : (
          <Link href={item.href} onClick={() => { setMobileOpen(false); onNavigate?.(); }}>
            {itemContent}
          </Link>
        )}
        {hasChildren && (isExpanded || childActive) && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children?.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const railContent = (
    <div className="h-full flex flex-col">
      {header && (
        <div className={cn('p-4 flex-shrink-0', isCollapsed && 'px-3')}>
          {header}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => renderNavItem(item))}
      </nav>
      {footer && (
        <div className={cn('p-4 flex-shrink-0 border-t', isCollapsed && 'px-3')}
          style={{ borderColor: designTokens.colors.outlineVariant }}
        >
          {footer}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMobileToggle}
        className="fixed top-4 left-4 z-50 lg:hidden rounded-xl"
        aria-label="Toggle navigation"
      >
        <Menu size={20} />
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 h-screen flex-shrink-0 transition-all duration-300 z-40',
          isCollapsed ? 'w-20' : 'w-64',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className
        )}
        style={{
          backgroundColor: designTokens.colors.surfaceContainerLow,
          fontFamily: designTokens.typography.fontFamily,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMobileToggle}
          className="absolute top-4 right-4 z-10 lg:hidden rounded-xl"
          aria-label="Close navigation"
        >
          <X size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCollapsedToggle}
          className="hidden lg:flex absolute top-4 right-4 z-10 rounded-xl"
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <ChevronRight
            size={20}
            className={cn('transition-transform', isCollapsed && 'rotate-180')}
          />
        </Button>

        {railContent}
      </aside>
    </>
  );
};

export default LeftRail;
