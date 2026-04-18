import { Suspense } from 'react';
import OrderedMapExplorer from '../components/OrderedMapExplorer';

export const metadata = {
  title: 'OrderedMap Explorer',
};

export default function OrderedMapPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading OrderedMap...</div>}>
      <OrderedMapExplorer />
    </Suspense>
  );
}
