import type { ReactNode } from 'react'
import { TAG_CATEGORY_STYLES } from './tagCategories'

export interface TagProps {
    label?: string
    category?: string | null
    icon?: ReactNode
    /** When set, hovering the tag shows a remove button in its top-left corner. */
    onRemove?: () => void
}

export function Tag({ label = 'tag', category = null, icon, onRemove }: TagProps) {
    const style = category ? TAG_CATEGORY_STYLES[category] : undefined
    const resolvedIcon = icon ?? style?.icon

    // no matching category style -> falls through to the neutral grey
    // defined on .tag in App.css
    const colorOverride = style
        ? { background: style.background, borderColor: style.border, color: style.color }
        : undefined

    return (
        <span className="tag" data-category={category ?? undefined} style={colorOverride}>
            {onRemove && (
                <button
                    type="button"
                    className="tag-remove-btn"
                    aria-label={`Remove tag ${label}`}
                    onClick={onRemove}
                >
                    −
                </button>
            )}
            {resolvedIcon != null && <span className="tag-icon">{resolvedIcon}</span>}
            <span className="tag-label select-none">{label}</span>
        </span>
    )
}

export default Tag
