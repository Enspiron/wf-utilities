import { Skeleton } from '@/components/ui/skeleton';

const GRID_SKELETON_COUNT = 140;

export default function ItemsPageSkeleton() {
  return (
    <div className='flex min-h-0 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background'>
      <div className='shrink-0 border-b border-border bg-background'>
        <div className='flex flex-wrap items-center gap-2 p-3 md:flex-nowrap md:gap-3 md:p-4'>
          <Skeleton className='order-1 h-10 w-44' />
          <Skeleton className='order-4 h-10 w-full md:order-2 md:flex-1 lg:hidden' />
          <Skeleton className='order-2 h-10 min-w-[170px] md:order-3 md:min-w-[210px] md:w-[220px]' />
          <Skeleton className='order-3 h-10 w-24 lg:hidden' />
          <Skeleton className='order-5 h-10 w-20' />
        </div>

        <div className='px-4 pb-3 lg:hidden'>
          <Skeleton className='h-4 w-44' />
        </div>
      </div>

      <div className='flex min-h-0 flex-1 overflow-hidden'>
        <aside className='hidden min-h-0 shrink-0 flex-col border-r border-border bg-card/30 lg:flex lg:w-[320px] xl:w-[360px]'>
          <div className='space-y-3 border-b border-border p-4'>
            <div className='grid grid-cols-2 gap-2'>
              <Skeleton className='h-[56px] w-full' />
              <Skeleton className='h-[56px] w-full' />
              <Skeleton className='h-[56px] w-full' />
              <Skeleton className='h-[56px] w-full' />
            </div>

            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>

          <div className='min-h-0 flex-1 space-y-3 overflow-hidden px-3 py-3'>
            <Skeleton className='h-[104px] w-full' />
            <Skeleton className='h-[104px] w-full' />
            <Skeleton className='h-[260px] w-full' />
            <Skeleton className='h-[84px] w-full' />
            <Skeleton className='h-8 w-full' />
          </div>
        </aside>

        <div className='min-h-0 flex-1 overflow-hidden'>
          <div className='h-full overflow-y-auto p-2 pb-24 sm:p-3 sm:pb-24 lg:p-2 lg:pb-24'>
            <div className='grid grid-cols-4 gap-0.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14'>
              {Array.from({ length: GRID_SKELETON_COUNT }).map((_, index) => (
                <div key={`items-grid-skeleton-${index}`} className='rounded-sm border border-border/60 bg-card p-0.5'>
                  <Skeleton className='aspect-square w-full rounded-sm' />
                  <Skeleton className='mx-auto mt-1 h-3 w-4/5' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-3 shadow-lg'>
        <div className='flex flex-wrap items-center justify-center gap-2'>
          <Skeleton className='h-8 w-20' />
          <Skeleton className='h-8 w-8' />
          <Skeleton className='h-8 w-8' />
          <Skeleton className='h-8 w-8' />
          <Skeleton className='h-8 w-8' />
          <Skeleton className='h-8 w-20' />
        </div>
      </div>
    </div>
  );
}
