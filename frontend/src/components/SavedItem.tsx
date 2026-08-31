import Tag from './Tag'
import type { TagChipData } from './tagCategories'


// Shape used wherever a list of order-history items is passed around
// (fetched data, props) — mirrors the `items` table plus its tags.
export interface SavedItemData {
    id: string
    name: string
    price?: number | string | null
    rating?: number | null
    tags?: TagChipData[]
}

export interface SavedItemProps {
    name?: string
    price?: number | string | null
    rating?: number | null
    tags?: TagChipData[]
}

function formatPrice(price: SavedItemProps['price']): string | null {
    if (price == null || price === '') return null
    const value = typeof price === 'string' ? Number(price) : price
    return Number.isNaN(value) ? null : `$${value.toFixed(2)}`
}

export function SavedItem({
    name = 'Item name',
    price = null,
    rating = null,
    tags = [{ id: 'placeholder-tag', label: 'tag' }],
}: SavedItemProps) {
    const formattedPrice = formatPrice(price)

    return (
        <div className="saved-item">
            <div className="saved-item-main">
                <span className="saved-item-name">{name}</span>
                {formattedPrice != null && <span className="saved-item-price">{formattedPrice}</span>}
            </div>

            {rating != null && <span className="saved-item-rating">★ {rating}</span>}

            {tags.length > 0 && (
                <div className="saved-item-tags">
                    {tags.map((tag) => (
                        <Tag key={tag.id} label={tag.label} category={tag.category} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default SavedItem