import { CircleAlert, CircleCheck } from 'lucide-react';

import { cn } from '@/lib/utils';

export function AuthNotice({
  tone,
  title,
  detail,
}: {
  tone: 'danger' | 'info';
  title: string;
  detail?: string;
}) {
  const Icon = tone === 'danger' ? CircleAlert : CircleCheck;

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-lg px-3.5 py-3 text-sm leading-snug',
        tone === 'danger'
          ? 'bg-status-danger text-status-danger-foreground'
          : 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />
      <div>
        <div className="font-medium">{title}</div>
        {detail ? <div className="mt-0.5">{detail}</div> : null}
      </div>
    </div>
  );
}
