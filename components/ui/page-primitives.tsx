import * as React from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const pageMaxWidthClasses = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-none',
} as const;

type PageMaxWidth = keyof typeof pageMaxWidthClasses;

type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  maxWidth?: PageMaxWidth;
};

const pageClassNames = {
  shell: 'mx-auto flex w-full flex-col gap-4 p-4 sm:p-6',
  surfaceCard: 'border-border/60 bg-background/85 backdrop-blur',
  searchIcon: 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
  searchInput: 'pl-9',
  inlineLoading: 'flex items-center gap-2 text-sm text-muted-foreground',
  inlineError: 'rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive',
  paginationFooter: 'flex items-center justify-between text-xs text-muted-foreground',
  sectionLabel: 'text-xs uppercase tracking-wide text-muted-foreground',
  fieldLabel: 'text-[10px] uppercase tracking-wide text-muted-foreground',
  compactPanel: 'rounded-md border border-border/60 bg-card/70 p-2',
} as const;

function PageShell({ className, maxWidth = '7xl', ...props }: PageShellProps) {
  return (
    <div
      className={cn(pageClassNames.shell, pageMaxWidthClasses[maxWidth], className)}
      {...props}
    />
  );
}

const SurfaceCard = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Card>>(
  ({ className, ...props }, ref) => (
    <Card ref={ref} className={cn(pageClassNames.surfaceCard, className)} {...props} />
  )
);
SurfaceCard.displayName = 'SurfaceCard';

type SearchFieldProps = React.ComponentPropsWithoutRef<typeof Input> & {
  iconClassName?: string;
};

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, iconClassName, ...props }, ref) => (
    <div className='relative flex-1'>
      <Search
        className={cn(pageClassNames.searchIcon, iconClassName)}
      />
      <Input ref={ref} className={cn(pageClassNames.searchInput, className)} {...props} />
    </div>
  )
);
SearchField.displayName = 'SearchField';

function InlineLoading({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(pageClassNames.inlineLoading, className)}>
      <Loader2 className='h-4 w-4 animate-spin' />
      {children}
    </div>
  );
}

function InlineError({ className, children }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn(pageClassNames.inlineError, className)}>
      {children}
    </p>
  );
}

type PaginationFooterProps = React.HTMLAttributes<HTMLDivElement> & {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

function PaginationFooter({ className, page, totalPages, onPrevious, onNext, ...props }: PaginationFooterProps) {
  return (
    <div className={cn(pageClassNames.paginationFooter, className)} {...props}>
      <span>
        Page {page} of {totalPages}
      </span>
      <div className='flex gap-1'>
        <Button size='sm' variant='outline' onClick={onPrevious} disabled={page === 1}>
          Previous
        </Button>
        <Button size='sm' variant='outline' onClick={onNext} disabled={page === totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}

export { InlineError, InlineLoading, pageClassNames, PageShell, PaginationFooter, SearchField, SurfaceCard };
