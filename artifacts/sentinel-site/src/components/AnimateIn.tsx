import { motion, Variants } from "framer-motion";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "fade";

interface AnimateInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: Direction;
  className?: string;
  /** Whether the animation triggers only once (default true) */
  once?: boolean;
  /** Viewport margin before the element is considered in view */
  margin?: string;
}

const directionOffsets: Record<Direction, { x?: number; y?: number }> = {
  up:    { y: 20 },
  down:  { y: -20 },
  left:  { x: 20 },
  right: { x: -20 },
  fade:  {},
};

/** Apple-style cubic-bezier easing */
const EASE = [0.25, 0.1, 0.25, 1] as const;

export default function AnimateIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = "up",
  className,
  once = true,
  margin = "-40px",
}: AnimateInProps) {
  const hidden: Variants["hidden"] = {
    opacity: 0,
    ...directionOffsets[direction],
  };

  const visible: Variants["visible"] = {
    opacity: 1,
    x: 0,
    y: 0,
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin }}
      variants={{ hidden, visible }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container — wraps children and staggers their animation.
 * Each direct child should be a `motion.div` or wrapped in `AnimateIn`.
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  once = true,
  margin = "-40px",
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
  margin?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger item — use as a direct child of `StaggerContainer`.
 */
export function StaggerItem({
  children,
  className,
  direction = "up",
  duration = 0.45,
}: {
  children: ReactNode;
  className?: string;
  direction?: Direction;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, ...directionOffsets[direction] },
        visible: { opacity: 1, x: 0, y: 0, transition: { duration, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
