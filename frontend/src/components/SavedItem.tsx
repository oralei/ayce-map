import Tag from './Tag'
import type { TagChipData } from './tagCategories'

// Shape used wherever a list of order-history items is passed around
// (fetched data, props) — mirrors the `items` table plus its tags.
export interface SavedItemData {
    id: string
    name: string
    price?: number | string | null
    rating?: number | string | null
    tags?: TagChipData[]
    description: string | null
}

export interface SavedItemProps {
    name?: string
    price?: number | string | null
    rating?: number | string | null
    tags?: TagChipData[]
    description: string | null
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
    description = 'Placeholder notes...'
}: SavedItemProps) {
    const formattedPrice = formatPrice(price)

    return (
        <div className="saved-item">
            <div className="saved-item-main">
                <span className="saved-item-name">{name}</span>
            </div>

            {rating != null ? (
                <div className="item-mini-block">
                    <span className="rating-label">★ Your Rating:</span>
                    <span className="rating-label">{rating}/10</span>
                </div>
                // need to make an editable rating UI here!
                ) : (
                // if the user has not rated
                <div className="item-mini-block">
                    <span className="rating-label">★ Your Rating:</span>
                    <span className="rating-label">not rated</span>
                </div>
            )}
            <div className="item-mini-block">
                {formattedPrice != null && <span className="rating-label">Price: {formattedPrice}</span>} 
            </div>

            <span className="panel-section-label">Tags</span>
            <div className="saved-item-tags">
                {tags.map((tag) => (
                    <Tag key={tag.id} label={tag.label} category={tag.category} />
                ))}
                <button type="button" className="tag-add-btn" aria-label="Add a tag">+</button>
            </div>

            <hr className="section-divider" />

            <span className="panel-section-label">Notes</span>
            <textarea
                className="item-input field-sizing-content resize-none"
                placeholder="Add notes here..."
                defaultValue={description ?? ''}
            />
        </div>
    )
}

export default SavedItem