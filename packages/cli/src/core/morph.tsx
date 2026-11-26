import type { Transition } from "framer-motion"

import { motion } from "framer-motion"

import { MORPH_TRANSITION } from "./animation-config"
import { useAnimationContext } from "./animation-context"

// =============================================================================
// TYPES
// =============================================================================

interface MorphProps {
  layoutId: string
  transition?: Transition
  className?: string
  children: React.ReactNode
}

interface MorphGroupProps {
  groupId: string
  transition?: Transition
  className?: string
  children: React.ReactNode
}

// =============================================================================
// MORPH COMPONENT
// =============================================================================

/**
 * Wrapper component that enables morph/shared-layout animations between slides.
 *
 * Usage:
 * ```tsx
 * // Slide 1 - Large version
 * <Morph layoutId="hero-title">
 *   <h1 className="text-6xl">Title</h1>
 * </Morph>
 *
 * // Slide 2 - Small version (same layoutId = morphs between them)
 * <Morph layoutId="hero-title">
 *   <h1 className="text-2xl">Title</h1>
 * </Morph>
 * ```
 */
export function Morph({
  layoutId,
  transition = MORPH_TRANSITION,
  className,
  children
}: MorphProps) {
  const { isExporting } = useAnimationContext()
  if (isExporting)
    return (
      <div className={className} data-ps-morph={layoutId}>
        {children}
      </div>
    )
  return (
    <motion.div
      layout
      layoutId={layoutId}
      initial={false}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// MORPH GROUP COMPONENT
// =============================================================================

export function MorphGroup({
  groupId,
  transition = MORPH_TRANSITION,
  className,
  children
}: MorphGroupProps) {
  const { isExporting } = useAnimationContext()
  if (isExporting)
    return (
      <div className={className} data-ps-morph={groupId}>
        {children}
      </div>
    )
  return (
    <motion.div
      layout
      layoutId={groupId}
      initial={false}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// MORPH ITEM (for use within MorphGroup pattern)
// =============================================================================

interface MorphItemProps {
  id: string
  prefix?: string
  transition?: Transition
  className?: string
  children: React.ReactNode
}

export function MorphItem({
  id,
  prefix,
  transition = MORPH_TRANSITION,
  className,
  children
}: MorphItemProps) {
  const layoutId = prefix ? `${prefix}-${id}` : id
  const { isExporting } = useAnimationContext()
  if (isExporting)
    return (
      <div className={className} data-ps-morph={layoutId}>
        {children}
      </div>
    )

  return (
    <motion.div
      layout
      layoutId={layoutId}
      initial={false}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// MORPH TEXT (specialized for text that changes size)
// =============================================================================

interface MorphTextProps {
  layoutId: string
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span"
  transition?: Transition
  className?: string
  children: React.ReactNode
}

export function MorphText({
  layoutId,
  as: Component = "span",
  transition = MORPH_TRANSITION,
  className,
  children
}: MorphTextProps) {
  const { isExporting } = useAnimationContext()
  if (isExporting)
    return (
      <Component className={className} data-ps-morph={layoutId}>
        {children}
      </Component>
    )
  const MotionComponent = motion[Component]

  return (
    <MotionComponent
      layout
      layoutId={layoutId}
      initial={false}
      transition={transition}
      className={className}
    >
      {children}
    </MotionComponent>
  )
}
