import { useEffect, useState } from 'react'
import axios from 'axios'
import type { PlaceResult } from './MainMap'

interface RestaurantViewProps {
    place: PlaceResult | null
}

interface LocationCheck {
    placeId: string
    exists: boolean
}

export function RestaurantView({ place }: RestaurantViewProps) {
    const [lastCheck, setLastCheck] = useState<LocationCheck | null>(null)

    useEffect(() => {
        if (!place) return

        let cancelled = false

        axios.get<{ exists: boolean }>('http://localhost:8080/location', {
            params: { google_place_id: place.google_place_id },
        })
            .then((res) => {
                if (!cancelled) {
                    setLastCheck({ placeId: place.google_place_id, exists: res.data.exists })
                }
            })
            .catch((err) => {
                console.error(err)
            })

        return () => {
            cancelled = true
        }
    }, [place])

    // a bool that returns true when the selected place is within the locations table (via google_place_id)
    const exists = place && lastCheck?.placeId === place.google_place_id ? lastCheck.exists : null

    return (
        <div className="restaurant-info-main">
            <h1 className="restaurant-name">
                {place?.name ?? 'Restaurant Name'}
            </h1>
            {place && (
                <>
                    {place.address != null && <p className="address">{place.address}</p>}
                    {place.rating != null && <p className="rating">★ {place.rating}</p>}
                    <div className="tags">
                        {place.tags.map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                    {/* temporary indicator for testing the /location check */}
                    <p className="in-db-check">
                        In DB: {exists === null ? 'checking...' : exists ? 'true' : 'false'}
                    </p>
                    {!exists && <button className="border-2 hover:bg-green-400 active:opacity-75">+ Add to List</button>}
                </>
            )}
        </div>
    )
}

export default RestaurantView