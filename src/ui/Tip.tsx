import type { ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Tooltip with shortcut
export function Tip({ label, keys, side, children }: { label: ReactNode; keys?: string[]; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span>{label}</span>
        {keys && (
          <span className="flex gap-0.5">
            {keys.map((k) => (
              <Kbd key={k} className="border-white/15 bg-white/10 text-background/80">{k}</Kbd>
            ))}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
