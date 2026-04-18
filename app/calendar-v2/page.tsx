import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import CalendarV2Client from './calendar-v2-client';

export default function CalendarV2Page() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-4'>
          <Card className='w-80'>
            <CardContent className='flex items-center gap-3 p-5'>
              <Loader2 className='h-5 w-5 animate-spin text-primary' />
              <div>
                <p className='text-sm font-medium'>Loading calendar</p>
                <p className='text-xs text-muted-foreground'>Normalizing event data</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CalendarV2Client />
    </Suspense>
  );
}
