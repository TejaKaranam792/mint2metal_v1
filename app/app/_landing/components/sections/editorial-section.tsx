"use client";

const platformMetrics = [
  { label: "Blockchain", value: "Stellar" },
  { label: "Smart Contracts", value: "Soroban" },
  { label: "Token Standard", value: "DST" },
  { label: "Custody Model", value: "100% Backed" },
];

export function EditorialSection() {
  return (
    <section className="bg-background">
      {/* Newsletter Banner */}


      {/* Decorative Icons */}
      <div className="flex items-center justify-center gap-6 pb-20">


      </div>

      {/* Platform Metrics Grid */}
      <div className="grid grid-cols-2 border-t border-border md:grid-cols-4">
        {platformMetrics.map((metric) => (
          <div
            key={metric.label}
            className="border-b border-r border-border p-8 text-center last:border-r-0 md:border-b-0"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {metric.label}
            </p>
            <p className="font-medium text-foreground text-4xl">
              {metric.value}
            </p>
          </div>
        ))}
      </div>


    </section>
  );
}
