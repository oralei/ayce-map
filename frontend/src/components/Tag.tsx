import type { ReactNode } from 'react'
import { TAG_CATEGORY_STYLES } from './tagCategories'

export interface TagProps {
    label?: string
    category?: string | null
    icon?: ReactNode
}

export function Tag({ label = 'tag', category = null, icon }: TagProps) {
    const style = category ? TAG_CATEGORY_STYLES[category] : undefined
    const resolvedIcon = icon ?? style?.icon

    // no matching category style -> falls through to the neutral grey
    // defined on .tag in App.css
    const colorOverride = style
        ? { background: style.background, borderColor: style.border, color: style.color }
        : undefined

    return (
        <span className="tag" data-category={category ?? undefined} style={colorOverride}>
            {resolvedIcon != null && <span className="tag-icon">{resolvedIcon}</span>}
            <span className="tag-label select-none">{label}</span>
        </span>
    )
}

export default Tag