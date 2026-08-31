import type { PlaceResult } from '../MainMap'
import type { LocationRecord } from '../RestaurantView'
import Tag from '../Tag'
import SavedItem, { type SavedItemData } from '../SavedItem'
import type { TagChipData } from '../tagCategories'

interface ManagePanelProps {
    place: PlaceResult
    location: LocationRecord
    tags?: TagChipData[]
    items?: SavedItemData[]
}

// shown until the location's tags are actually fetched
const PLACEHOLDER_TAGS: TagChipData[] = [
    { id: 'placeholder-tag-1', label: 'tag' },
    { id: 'placeholder-tag-2', label: 'tag' },
]

// shown until the location's order history is actually fetched
const PLACEHOLDER_ITEMS: SavedItemData[] = [
    {
        id: 'placeholder-item',
        name: 'Item name',
        price: 0,
        tags: [{ id: 'placeholder-item-tag', label: 'tag' }],
    },
]

export function ManagePanel({ place, location, tags, items }: ManagePanelProps) {
    const displayTags = tags && tags.length > 0 ? tags : PLACEHOLDER_TAGS
    const displayItems = items && items.length > 0 ? items : PLACEHOLDER_ITEMS

    return (
        <div className="restaurant-info-main">
            <h1 className="restaurant-name">{place.name}</h1>
            {place.address != null && <p className="address">{place.address}</p>}

            <div className="tag-panel-section">
                <span className="panel-section-label">Tags</span>
                <div className="location-tags-list">
                    {displayTags.map((tag) => (
                        <Tag key={tag.id} label={tag.label} category={tag.category} />
                    ))}
                </div>
            </div>

            {location.rating != null ? (
                <div className="rating-block">
                    <span className="rating-label">Your rating</span>
                    <span className="rating-value">★ {location.rating}</span>
                </div>
                // need to make an editable rating UI here!
                ) : (
                // if the user has not rated
                <div className="rating-block">
                    <span className="rating-label">Your rating</span>
                    <span className="rating-value">not rated</span>
                </div>
            )}
            <div className="status-row">
                <span className="status-indicator in-list">● added to list</span>
            </div>

            <div className="orders-panel-section">
                <span className="orders-label">My Items</span>
                <div className="saved-items-list">
                    {displayItems.map((item) => (
                        <SavedItem
                            key={item.id}
                            name={item.name}
                            price={item.price}
                            rating={item.rating}
                            tags={item.tags}
                        />
                    ))}
                </div>
            </div>

        </div>
    )
}

export default ManagePanel