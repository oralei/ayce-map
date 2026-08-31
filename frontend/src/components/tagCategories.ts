import type { ReactNode } from 'react'

// One entry per tag category (matches a category name coming from the `tags`
// table / item_tags.category). Add a key here whenever a category should get
// its own look — background/border/color are the only things you need to
// set to move a category off the default grey. Icon is optional.
export interface TagCategoryStyle {
    background: string
    border: string
    color: string
    icon?: ReactNode
}

export const TAG_CATEGORY_STYLES: Record<string, TagCategoryStyle> = {
    // spicy: { background: '#ffe1d1', border: '#e0895a', color: '#7a3616', icon: '🌶️' },
    // vegetarian: { background: '#e3f1d9', border: '#7fae5a', color: '#2c4a1a', icon: '🌱' },
}

// Shape used wherever a list of tags is passed around (fetched data, props).
export interface TagChipData {
    id: string
    label: string
    category?: string | null
}