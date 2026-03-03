'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type GoBackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export default function GoBackButton({
  fallbackHref = '/items',
  label = 'Go Back',
  className,
}: GoBackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <Button type='button' variant='outline' size='sm' onClick={handleClick} className={className}>
      <ArrowLeft className='mr-2 h-4 w-4' />
      {label}
    </Button>
  );
}

