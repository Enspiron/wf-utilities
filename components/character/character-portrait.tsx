'use client';

import { useState } from 'react';
import Image from 'next/image';
import { buildCharacterSquareImageUrl, characterClassNames } from '@/lib/character-assets';
import { cn } from '@/lib/utils';

type CharacterPortraitProps = {
  name: string;
  faceCode?: string;
  src?: string;
  className?: string;
  imageClassName?: string;
  fallbackLabel?: string;
};

function CharacterPortrait({
  name,
  faceCode,
  src,
  className,
  imageClassName,
  fallbackLabel = 'No Img',
}: CharacterPortraitProps) {
  const imageSrc = src || (faceCode ? buildCharacterSquareImageUrl(faceCode) : '');
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!imageSrc || failedSrc === imageSrc) {
    return <div className={cn(characterClassNames.portraitFallback, className)}>{fallbackLabel}</div>;
  }

  return (
    <Image
      src={imageSrc}
      alt={name}
      fill
      className={cn(characterClassNames.portraitImage, imageClassName)}
      loading='lazy'
      unoptimized
      onError={() => setFailedSrc(imageSrc)}
    />
  );
}

export { CharacterPortrait };
