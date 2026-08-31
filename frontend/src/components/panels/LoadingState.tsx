import type { PlaceResult } from '../MainMap'

interface LoadingStateProps {
    place: PlaceResult
}

export function LoadingState({ place }: LoadingStateProps) {
    return (
        <div className="restaurant-info-main">
            <h1 className="restaurant-name">{place.name}</h1>
            {place.address != null && <p className="address">{place.address}</p>}
            <div className="status-row">
                <span className="status-indicator">checking list...</span>
            </div>
        </div>
    )
}

export default LoadingState