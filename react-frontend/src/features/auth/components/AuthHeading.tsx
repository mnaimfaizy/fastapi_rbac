import type { ReactNode } from 'react';

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
        {title}
      </h1>
      {description ? (
        <p className="text-foreground-secondary mt-1.5 text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}
