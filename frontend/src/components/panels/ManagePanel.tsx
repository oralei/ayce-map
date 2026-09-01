import type { PlaceResult } from '../MainMap'
import type { LocationRecord } from '../RestaurantView'
import Tag from '../Tag'
import SavedItem, { type SavedItemData } from '../SavedItem'

interface ManagePanelProps {
    place: PlaceResult
    location: LocationRecord
    items?: SavedItemData[]
}

export function ManagePanel({ place, location, items = [] }: ManagePanelProps) {
    const tags = location.tags

    return (
        <div className="restaurant-info-main">
            <div className="restaurant-header-row">
                <div className="restaurant-title-group">
                    <h1 className="restaurant-name">{place.name}</h1>
                    {location.rating != null ? (
                        <div className="rating-block">
                            <span className="rating-label">Your Rating:</span>
                            <span className="rating-value">★ {location.rating}</span>
                        </div>
                        // need to make an editable rating UI here!
                        ) : (
                        // if the user has not rated
                        <div className="rating-block">
                            <span className="rating-label">Your Rating:</span>
                            <span className="rating-value">not rated</span>
                        </div>
                    )}
                </div>
                <span className="status-indicator in-list select-none">Added to list ✓</span>
            </div>

            {place.address != null && <p className="address">{place.address}</p>}

            <div className="tag-panel-section">
                <span className="panel-section-label">Tags</span>
                <div className="location-tags-list">
                    {tags.length === 0 && <p className="empty-tags-message">No tags yet.</p>}
                    {tags.map((tag) => (
                        <Tag key={tag.id} label={tag.label} category={tag.category} />
                    ))}
                    <button type="button" className="tag-add-btn" aria-label="Add a tag">+</button>
                </div>
            </div>

            <hr className="section-divider" />

            <span className="panel-section-label">Notes</span>
            <textarea className="restaurant-description field-sizing-content resize-none" placeholder="Add notes here..."></textarea>

            <div className="orders-panel-section">
                <span className="orders-label">My Items</span>
                <hr className="section-divider" />
                <div className="saved-items-list">
                    {items.length === 0 ? (
                        <p className="empty-items-message">No items logged yet.</p>
                    ) : (
                        items.map((item) => (
                            <SavedItem
                                key={item.id}
                                name={item.name}
                                price={item.price}
                                rating={item.rating}
                                tags={item.tags}
                                description={item.description}
                            />
                        ))
                    )}
                    <button type="button" className="add-new-item-box">+ add a new item</button>
                </div>
            </div>

        </div>
    )
}

export default ManagePanel