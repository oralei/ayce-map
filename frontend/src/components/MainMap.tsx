import { GoogleMap, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { useState, useCallback } from 'react'

export interface PlaceResult {
    id: string
    google_place_id: string
    name: string
    address: string | null
    lat: number
    lng: number
    tags: string[]
    rating: number | null
}

interface MainMapProps {
    onSelectPlace: (place: PlaceResult | null) => void
}

const containerStyle = {
    width: '100%',
    height: '100%',
}

const center = {
    lat: 50.41241888678845, 
    lng: -104.63000327995762,
}

// Map options: Hides all default Google POIs
const mapOptions: google.maps.MapOptions = {
    styles: [
        { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.school', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.park', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.medical', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.government', stylers: [{ visibility: 'off' }], },
        { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }], },
        {
            featureType: 'transit',
            stylers: [{ visibility: 'off' }],
        },
    ],
}

// Food & drink place types; POI clicks outside these are ignored
const FOOD_TYPES = ['restaurant', 'fast_food_restaurant', 'cafe', 'diner', 'food_court', 'pub', 'bar', 'bakery', 'meal_takeaway']

export function MainMap({ onSelectPlace }: MainMapProps) {
    const [selected, setSelected] = useState<PlaceResult | null>(null)

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: String(import.meta.env.VITE_GOOGLE_MAPS_KEY),
        libraries: ['places'],
    })

    // Select a place by clicking one of Google's basemap POIs
    const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
        // Clicks on empty map have no placeId
        if (!('placeId' in e) || !e.placeId) {
            setSelected(null)
            onSelectPlace(null)
            return
        }

        const iconEvent = e as google.maps.IconMouseEvent
        iconEvent.stop() // suppress Google's default POI info card

        try {
            const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
            const place = new Place({ id: iconEvent.placeId! })
            await place.fetchFields({ fields: ['id', 'displayName', 'location', 'rating', 'formattedAddress', 'types'] })

            if (!place.types?.some((t) => FOOD_TYPES.includes(t))) return

            const result: PlaceResult = {
                id: place.id,
                google_place_id: place.id,
                name: place.displayName || 'Unknown',
                address: place.formattedAddress ?? null,
                lat: place.location?.lat() ?? iconEvent.latLng?.lat() ?? 0,
                lng: place.location?.lng() ?? iconEvent.latLng?.lng() ?? 0,
                tags: [],
                rating: place.rating ?? null,
            }

            setSelected(result)
            onSelectPlace(result)
        } catch (error) {
            console.error('Error fetching place details:', error)
        }
    }, [onSelectPlace])

    if (!isLoaded) return <></>

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            options={mapOptions}
            zoom={13}
            onClick={onMapClick}
        >
            {selected && (
                <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => {
                        setSelected(null)
                        onSelectPlace(null)
                    }}
                >
                    <div><h3>{selected.name != null ? selected.name : selected.google_place_id}</h3></div>
                </InfoWindow>
            )}
        </GoogleMap>
    )
}

export default MainMap