import { Skeleton } from '@/components/ui/skeleton';

export default function FeatureTimelineLoading() {
  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_40%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_45%)]'>
      <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 sm:p-6'>
        <div className='rounded-lg border border-border/60 bg-background/85 p-4 sm:p-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-2'>
              <Skeleton className='h-7 w-56' />
              <Skeleton className='h-4 w-80' />
            </div>
            <Skeleton className='h-9 w-28' />
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            <Skeleton className='h-6 w-20' />
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-6 w-24' />
          </div>
        </div>

        <div className='rounded-lg border border-border/60 bg-background/85 p-4 sm:p-5'>
          <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px]'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='mt-2 grid gap-2 md:grid-cols-[150px_150px_150px_auto]'>
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-9 w-full' />
            <Skeleton className='h-9 w-full' />
            <div className='flex gap-2'>
              <Skeleton className='h-9 w-24' />
              <Skeleton className='h-9 w-24' />
            </div>
          </div>
        </div>

        <div className='grid gap-3'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className='rounded-lg border border-border/60 bg-background/85 p-3'>
              <div className='flex flex-col gap-3 md:flex-row'>
                <Skeleton className='h-28 w-full md:h-24 md:w-[240px]' />
                <div className='min-w-0 flex-1 space-y-2'>
                  <Skeleton className='h-5 w-56' />
                  <Skeleton className='h-4 w-72' />
                  <div className='flex flex-wrap gap-2'>
                    <Skeleton className='h-5 w-24' />
                    <Skeleton className='h-5 w-24' />
                    <Skeleton className='h-5 w-20' />
                    <Skeleton className='h-5 w-16' />
                  </div>
                  <Skeleton className='h-3 w-full' />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
