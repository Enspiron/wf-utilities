import { Skeleton } from '@/components/ui/skeleton';

export default function EquipmentDetailLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-b from-background via-background to-muted/20'>
      <div className='mx-auto w-full max-w-7xl space-y-4 p-4 md:space-y-6 md:p-6'>
        <div className='flex flex-wrap items-center gap-2'>
          <Skeleton className='h-9 w-32' />
          <Skeleton className='h-8 w-24' />
          <Skeleton className='h-8 w-20' />
          <Skeleton className='h-8 w-28' />
        </div>

        <div className='grid gap-4 rounded-lg border border-border/70 bg-card/80 p-4 md:grid-cols-[120px,minmax(0,1fr)] md:gap-6 md:p-6'>
          <Skeleton className='mx-auto h-24 w-24 md:mx-0' />
          <div className='space-y-3'>
            <Skeleton className='h-8 w-1/2' />
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-28 w-full' />
            <div className='grid gap-3 md:grid-cols-2'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-20 w-full' />
            </div>
          </div>
        </div>

        <Skeleton className='h-20 w-full rounded-lg border border-border/70 bg-card/80' />
        <Skeleton className='h-[520px] w-full rounded-lg border border-border/70 bg-card/80' />
      </div>
    </div>
  );
}
