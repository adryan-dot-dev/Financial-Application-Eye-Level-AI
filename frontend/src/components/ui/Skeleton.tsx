import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn('skeleton', className)} style={style} />
}

export function SkeletonText({ className, style }: SkeletonProps) {
  return <div className={cn('skeleton skeleton-text', className)} style={style} />
}

export function SkeletonHeading({ className, style }: SkeletonProps) {
  return <div className={cn('skeleton skeleton-heading', className)} style={style} />
}

export function SkeletonCircle({ className, style }: SkeletonProps) {
  return <div className={cn('skeleton skeleton-circle', className)} style={style} />
}

/** Premium KPI card skeleton with synced shimmer */
export function KpiCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="card overflow-hidden" style={{ animationDelay: `${index * 100}ms` }}>
      <div className="h-1 skeleton" />
      <div className="p-5 skeleton-group">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 skeleton-circle" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-16 w-14 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}

/** Premium dashboard widget skeleton */
export function WidgetSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b px-7 py-5 skeleton-group" style={{ borderColor: 'var(--border-primary)' }}>
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="p-6 skeleton-group">
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Premium table row skeleton */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 skeleton-group">
      <Skeleton className="h-8 w-8 skeleton-circle" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 flex-1"
          style={{ maxWidth: i === 0 ? '180px' : '100px' }}
        />
      ))}
    </div>
  )
}
