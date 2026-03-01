import { Suspense } from 'react';
import OrderedMapExplorerV2 from '../components/OrderedMapExplorerV2';

export const metadata = {
  title: 'OrderedMap Explorer V2',
};

export default function OrderedMapPageV2() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading OrderedMap V2...</div>}>
      <OrderedMapExplorerV2 />
    </Suspense>
  );
}
