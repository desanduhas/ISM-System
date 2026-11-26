import type { LucideIcon } from "lucide-react";

interface Metric {
  label: string;
  value: number | string;
  detail?: string;
  icon: LucideIcon;
}

export default function ModuleMetrics({ items }: { items: Metric[] }) {
  return (
    <dl className="module-metrics" data-count={items.length}>
      {items.map(({ label, value, detail, icon: Icon }) => (
        <div className="module-metric" key={label}>
          <dt>
            <span>{label}</span>
            <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
          </dt>
          <dd>
            <strong>{value}</strong>
            {detail && <span>{detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
