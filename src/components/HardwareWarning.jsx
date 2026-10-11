import { AlertTriangle } from 'lucide-react';

export default function HardwareWarning({ warnings }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="warning-banner">
      <AlertTriangle size={20} color="var(--warning-color)" />
      <div>
        <strong>Hardware Limitation Detected</strong>
        {warnings.map((warn, i) => (
          <p key={i} style={{ marginTop: '0.2rem', fontSize: '0.85rem' }}>{warn}</p>
        ))}
      </div>
    </div>
  );
}
