interface HoursProgressBarProps {
  used: number;
  total: number;
  showLabel?: boolean;
}

export default function HoursProgressBar({ used, total, showLabel = false }: HoursProgressBarProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const overflowPercentage = total > 0 ? (used / total) * 100 : 0;

  let colorClass = 'progress-green';
  if (overflowPercentage >= 100) colorClass = 'progress-red';
  else if (overflowPercentage >= 80) colorClass = 'progress-yellow';

  return (
    <div>
      <div className={`progress-bar ${colorClass}`}>
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>{used}h usate</span>
          <span>{total}h totali</span>
        </div>
      )}
    </div>
  );
}
