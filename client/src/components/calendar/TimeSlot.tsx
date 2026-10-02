interface TimeSlotProps {
  hour: number;
  dayIndex: number;
  children?: React.ReactNode;
  onClick?: (hour: number, dayIndex: number) => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function TimeSlot({ hour, dayIndex, children, onClick, style, className }: TimeSlotProps) {
  return (
    <div
      className={`calendar-time-slot ${className || ''}`}
      onClick={() => onClick?.(hour, dayIndex)}
      id={`timeslot-${dayIndex}-${hour}`}
      style={style}
    >
      {children}
    </div>
  );
}
