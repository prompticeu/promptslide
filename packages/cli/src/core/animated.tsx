import { motion, Variants } from "framer-motion"

import {
  ELEMENT_SLIDE_DISTANCE,
  SPRING_SNAPPY,
  STAGGER_DELAY,
  STEP_ANIMATION_DURATION
} from "./animation-config"
import { useAnimationContext } from "./animation-context"

// =============================================================================
// ANIMATION TYPES & VARIANTS
// =============================================================================

export type AnimationType =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale"

const animationVariants: Record<AnimationType, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  },
  "slide-up": {
    hidden: { opacity: 0, y: ELEMENT_SLIDE_DISTANCE },
    visible: { opacity: 1, y: 0 }
  },
  "slide-down": {
    hidden: { opacity: 0, y: -ELEMENT_SLIDE_DISTANCE },
    visible: { opacity: 1, y: 0 }
  },
  "slide-left": {
    hidden: { opacity: 0, x: ELEMENT_SLIDE_DISTANCE },
    visible: { opacity: 1, x: 0 }
  },
  "slide-right": {
    hidden: { opacity: 0, x: -ELEMENT_SLIDE_DISTANCE },
    visible: { opacity: 1, x: 0 }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  }
}

interface AnimatedProps {
  /** Which step reveals this content (1-indexed) */
  step: number
  /** Animation type */
  animation?: AnimationType
  /** Animation duration in seconds */
  duration?: number
  /** Delay after trigger in seconds */
  delay?: number
  /** Custom className */
  className?: string
  children: React.ReactNode
}

/**
 * Animated element that appears at a specific animation step.
 *
 * The step count is now declared in slide config rather than discovered
 * at runtime, so this component simply consumes the context without
 * needing to register itself.
 */
export function Animated({
  step,
  animation = "slide-up",
  duration = STEP_ANIMATION_DURATION,
  delay = 0,
  className,
  children
}: AnimatedProps) {
  const { currentStep, showAllAnimations } = useAnimationContext()

  // Show all animations when navigating backward, otherwise check step
  const isVisible = showAllAnimations || currentStep >= step

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={animationVariants[animation]}
      transition={{
        ...SPRING_SNAPPY,
        duration,
        delay: isVisible ? delay : 0
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Wrapper for staggering multiple children.
 * Each direct child will be animated in sequence.
 */
interface AnimatedGroupProps {
  /** Starting step for the first child */
  startStep: number
  /** Animation type for all children */
  animation?: AnimationType
  /** Delay between each child in seconds */
  staggerDelay?: number
  className?: string
  children: React.ReactNode
}

export function AnimatedGroup({
  startStep,
  animation = "slide-up",
  staggerDelay = STAGGER_DELAY,
  className,
  children
}: AnimatedGroupProps) {
  const { currentStep, showAllAnimations } = useAnimationContext()

  const childArray = Array.isArray(children) ? children : [children]

  // Show all animations when navigating backward, otherwise check step
  const isVisible = showAllAnimations || currentStep >= startStep

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay
      }
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className={className}
    >
      {childArray.map((child, index) => (
        <motion.div key={index} variants={animationVariants[animation]}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
