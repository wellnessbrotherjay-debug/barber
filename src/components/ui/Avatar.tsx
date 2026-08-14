import React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string | React.ReactNode;
}

const Avatar = React.forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, fallback, alt, src, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(!src);

    if (imageError || !src) {
      return (
        <div
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-lg bg-surface text-ink font-semibold text-sm',
            className
          )}
        >
          {fallback}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt || 'Avatar'}
        className={cn(
          'w-12 h-12 rounded-lg object-cover bg-surface',
          className
        )}
        onError={() => setImageError(true)}
        {...props}
      />
    );
  }
);
Avatar.displayName = 'Avatar';

export { Avatar };
