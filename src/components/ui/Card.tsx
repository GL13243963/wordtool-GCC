import type { PropsWithChildren } from 'react'

export const Card = ({ children, className = '' }: PropsWithChildren<{ className?: string }>) => (
  <section className={`card ${className}`.trim()}>{children}</section>
)
