import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

const metrics = [
  { value: "$10M", label: "Revenue", description: "Annual recurring revenue", barWidth: "w-4/5" },
  { value: "50K", label: "Users", description: "Monthly active users", barWidth: "w-3/5" },
  { value: "99.9%", label: "Uptime", description: "Service reliability", barWidth: "w-[95%]" },
]

export function SlideBigNumber({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="TRACTION"
      title="Key Metrics"
    >
      <div className="flex h-full items-center">
        <div className="grid w-full grid-cols-3 gap-10">
          {metrics.map((metric, index) => (
            <Animated key={metric.label} step={index + 1} animation="slide-up">
              <div>
                <div className="text-6xl font-bold tracking-tight text-primary">
                  {metric.value}
                </div>
                <div className={`mt-4 h-1 rounded-full bg-gradient-to-r from-primary to-primary/30 ${metric.barWidth}`} />
                <div className="mt-3 text-lg font-semibold text-foreground">
                  {metric.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {metric.description}
                </div>
              </div>
            </Animated>
          ))}
        </div>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideBigNumber, steps: 3 }
