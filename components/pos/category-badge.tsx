import { Badge } from "@/components/ui/badge"

interface CategoryBadgeProps {
  category: {
    id: string
    name: string
    displayName: string
    color: string
    icon?: string
  }
  showIcon?: boolean
  showCount?: boolean
  count?: number
}

export function CategoryBadge({ category, showIcon = true, showCount = false, count }: CategoryBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className="font-medium"
      style={{
        backgroundColor: `${category.color}20`,
        color: category.color,
        borderColor: category.color,
      }}
    >
      {showIcon && category.icon && <span className="mr-1">{category.icon}</span>}
      {category.displayName}
      {showCount && count !== undefined && <span className="ml-1">({count})</span>}
    </Badge>
  )
}
