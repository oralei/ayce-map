import type { PlaceResult } from '../MainMap'

interface DiscoverPanelProps {
    place: PlaceResult
    adding: boolean
    error: string | null
    onAdd: () => void
}

export function DiscoverPanel({ place, adding, error, onAdd }: DiscoverPanelProps) {
    return (
        <div className="restaurant-info-main">
            <h1 className="restaurant-name">{place.name}</h1>
            {place.address != null && <p className="address">{place.address}</p>}

            {place.rating != null && (
                <div className="rating-block">
                    <span className="rating-label">Google rating</span>
                    <span className="rating-value">★ {place.rating}</span>
                </div>
            )}

            <div className="status-row">
                <span className="status-indicator not-in-list">○ not added to list</span>
            </div>

            <div className="add-to-list-wrap">
                <button className="add-to-list-btn" onClick={onAdd} disabled={adding}>
                    {adding ? 'adding...' : '+ add to your list'}
                </button>
                {error && <p className="add-error">{error}</p>}
            </div>
        </div>
    )
}

export default DiscoverPanel