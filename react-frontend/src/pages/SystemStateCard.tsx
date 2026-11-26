import type { ComponentType, ReactNode, SVGProps } from 'react';

interface SystemStateCardProps {
  /** Outline icon for the state, such as a lucide icon. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  children: ReactNode;
  /** The ways out: one or two buttons or links. */
  actions: ReactNode;
}

/**
 * The card a signed-in page shows inside the shell when it can't show
 * itself: the in-app 404 and Unauthorized artboards.
 */
export function SystemStateCard({
  icon: Icon,
  title,
  children,
  actions,
}: SystemStateCardProps) {
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <section className="bg-card text-card-foreground mt-10 rounded-[12px] border p-6">
        <div className="flex flex-col items-center gap-2.5 px-6 py-16 text-center">
          <span className="bg-card text-foreground-secondary flex size-12 items-center justify-center rounded-[12px] border">
            <Icon aria-hidden="true" className="size-[22px]" />
          </span>
          <h2 className="mt-1 text-lg leading-[22px] font-semibold">{title}</h2>
          <p className="text-foreground-secondary max-w-[420px] text-sm leading-[1.55]">
            {children}
          </p>
          <div className="mt-1 flex gap-2">{actions}</div>
        </div>
      </section>
    </div>
  );
}
