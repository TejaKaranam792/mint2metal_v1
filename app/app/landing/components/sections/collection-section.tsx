"use client";

import { FadeImage } from "@/components/fade-image";

const dstMetrics = [
  {
    id: 1,
    name: "Total Silver Backed",
    description: "Physical silver in secure custody",
    value: "Coming Soon",
    image: "/images/hero-main-silver.png",
  },
  {
    id: 2,
    name: "DST Tokens Minted",
    description: "Total tokens in circulation",
    value: "Coming Soon",
    image: "/images/blockchain-network.png",
  },
  {
    id: 3,
    name: "Custody Locations",
    description: "Secure vault facilities worldwide",
    value: "Coming Soon",
    image: "/images/silver-custody.png",
  },
  {
    id: 4,
    name: "Audit Frequency",
    description: "Third-party verification schedule",
    value: "Coming Soon",
    image: "/images/international-ops.png",
  },
  {
    id: 5,
    name: "Batch Processing Time",
    description: "Average mint/burn processing duration",
    value: "Coming Soon",
    image: "/images/digital-trading.png",
  },
  {
    id: 6,
    name: "Compliance Status",
    description: "Regulatory framework adherence",
    value: "Active",
    image: "/images/indian-ops.png",
  },
];

export function CollectionSection() {
  return (
    <section id="security" className="bg-background">
      {/* Section Title */}
      <div className="px-6 py-20 md:px-12 lg:px-20 md:py-10">
        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Digital Silver Token (DST)
        </h2>
      </div>

      {/* Accessories Grid/Carousel */}
      <div className="pb-24">
        {/* Mobile: Horizontal Carousel */}
        <div className="flex gap-6 overflow-x-auto px-6 pb-4 md:hidden snap-x snap-mandatory scrollbar-hide">
          {dstMetrics.map((metric) => (
            <div key={metric.id} className="group flex-shrink-0 w-[75vw] snap-center">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={metric.image || "/placeholder.svg"}
                  alt={metric.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {metric.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {metric.description}
                    </p>
                  </div>
                  <span className="text-lg font-medium text-foreground">
                    {metric.value}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 md:px-12 lg:px-20">
          {dstMetrics.map((metric) => (
            <div key={metric.id} className="group">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={metric.image || "/placeholder.svg"}
                  alt={metric.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {metric.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {metric.description}
                    </p>
                  </div>
                  <span className="font-medium text-foreground text-2xl">
                    {metric.value}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
