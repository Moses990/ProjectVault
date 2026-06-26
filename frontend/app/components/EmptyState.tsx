"use client";

export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, marginBottom: description ? 8 : 0 }}>{title}</p>
      {description && <p className="text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
