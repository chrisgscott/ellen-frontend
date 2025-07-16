import React from 'react';
import { cn } from '@/lib/utils';

const impactMap: { [key: string]: { value: number; color: string } } = {
  minimal: { value: 1, color: 'bg-sky-500' },
  moderate: { value: 2, color: 'bg-yellow-500' },
  large: { value: 3, color: 'bg-orange-500' },
  massive: { value: 4, color: 'bg-destructive' },
};

interface ScoreIndicatorProps {
  label: string;
  score: number | string;
  scoreType: 'numerical' | 'categorical';
  className?: string;
}

const ScoreIndicator = ({ label, score, scoreType, className }: ScoreIndicatorProps) => {
  let displayValue = 0;
  let totalValue = 5;
  let colorClass = 'bg-muted';

  if (scoreType === 'categorical' && typeof score === 'string' && impactMap[score.toLowerCase()]) {
    const impact = impactMap[score.toLowerCase()];
    displayValue = impact.value;
    totalValue = Object.keys(impactMap).length; // 4
    colorClass = impact.color;
  } else if (scoreType === 'numerical' && typeof score === 'number') {
    totalValue = 5;
    displayValue = Math.round(score * totalValue);
    const normalized = displayValue / totalValue;
    if (normalized < 0.4) colorClass = 'bg-destructive';
    else if (normalized < 0.7) colorClass = 'bg-yellow-500';
    else colorClass = 'bg-green-500';
  }

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {[...Array(totalValue)].map((_, i) => (
          <div
            key={i}
            className={cn('w-5 h-2 rounded-full', i < displayValue ? colorClass : 'bg-muted')}
          />
        ))}
      </div>
    </div>
  );
};

export default ScoreIndicator;
