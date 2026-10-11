import { GoogleMap, InfoWindow, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { useState, useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { resultPosition, type SearchResult } from './search'

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

// imperative hooks App uses to tie searches to the map viewport
export interface MainMapHandle {
    getBounds: () => google.maps.LatLngBoundsLiteral | null
    fitResults: (results: SearchResult[]) => void
}

interface MainMapProps {
    ref?: Ref<MainMapHandle>
    selectedPlace: PlaceResult | null
    onSelectPlace: (place: PlaceResult | null) => void
    results: SearchResult[]
    hoveredResultId: string | null
    onHoverResult: (id: string | null) => void
    onSelectResult: (result: SearchResult) => void
    /** true while filters are active, so "search this area" can be offered */
    searchActive: boolean
    /** bounds the current results were searched in; null means searched everywhere */
    searchedBounds: google.maps.LatLngBoundsLiteral | null
    onSearchArea: (bounds: google.maps.LatLngBoundsLiteral) => void
}

const containerStyle = {
    width: '100%',
    height: '100%',
}

// fallback when geolocation is denied or unavailable
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

// square pin with a pointer, matching .pin in App.css; anchored at the tip
const PIN_PATH = 'M0 0 H20 V20 H14 L10 26 L6 20 H0 Z'
// colors mirror --pin / --pin-active / --brand-a in App.css
const PIN_COLOR = '#c93868'
const PIN_ACTIVE_COLOR = '#3a1226'
const PIN_HOVER_COLOR = '#ff6fa8'

// bounds are treated as unchanged within this many degrees
const BOUNDS_EPSILON = 1e-6

function boundsEqual(a: google.maps.LatLngBoundsLiteral, b: google.maps.LatLngBoundsLiteral): boolean {
    return (['north', 'south', 'east', 'west'] as const).every((k) => Math.abs(a[k] - b[k]) < BOUNDS_EPSILON)
}

function pinIcon(color: string): google.maps.Symbol {
    return {
        path: PIN_PATH,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: PIN_ACTIVE_COLOR,
        strokeWeight: 2,
        anchor: new google.maps.Point(10, 26),
        labelOrigin: new google.maps.Point(10, 10),
    }
}

export function MainMap({
    ref,
    selectedPlace,
    onSelectPlace,
    results,
    hoveredResultId,
    onHoverResult,
    onSelectResult,
    searchActive,
    searchedBounds,
    onSearchArea,
}: MainMapProps) {
    const [map, setMap] = useState<google.maps.Map | null>(null)
    const [userPosition, setUserPosition] = useState<google.maps.LatLngLiteral | null>(null)
    // viewport as of the last time the map settled
    const [viewBounds, setViewBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null)
    // only jump to the user's position once, not every time it's re-read
    const centeredOnUser = useRef(false)

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: String(import.meta.env.VITE_GOOGLE_MAPS_KEY),
        libraries: ['places'],
    })

    useImperativeHandle(ref, () => ({
        getBounds: () => map?.getBounds()?.toJSON() ?? null,
        fitResults: (fitTo) => {
            if (!map || fitTo.length === 0) return
            if (fitTo.length === 1) {
                map.panTo(resultPosition(fitTo[0]))
                return
            }
            const bounds = new google.maps.LatLngBounds()
            fitTo.forEach((r) => bounds.extend(resultPosition(r)))
            map.fitBounds(bounds)
        },
    }), [map])

    // ask for the user's location once; on denial/error the map stays on the fallback center
    useEffect(() => {
        if (!('geolocation' in navigator)) return
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('geolocation unavailable:', err.message),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
        )
    }, [])

    useEffect(() => {
        if (!map || !userPosition || centeredOnUser.current) return
        centeredOnUser.current = true
        map.panTo(userPosition)
    }, [map, userPosition])

    // bring a selected place into view if it's off-screen (e.g. picked from the results list)
    useEffect(() => {
        if (!map || !selectedPlace) return
        const position = { lat: selectedPlace.lat, lng: selectedPlace.lng }
        if (!map.getBounds()?.contains(position)) map.panTo(position)
    }, [map, selectedPlace])

    const onIdle = useCallback(() => {
        setViewBounds(map?.getBounds()?.toJSON() ?? null)
    }, [map])

    // an unbounded ("everywhere") search always offers narrowing back to the view
    const movedSinceSearch = viewBounds != null && (searchedBounds == null || !boundsEqual(viewBounds, searchedBounds))

    // Select a place by clicking one of Google's basemap POIs
    const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
        // Clicks on empty map have no placeId
        if (!('placeId' in e) || !e.placeId) {
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

            onSelectPlace(result)
        } catch (error) {
            console.error('Error fetching place details:', error)
        }
    }, [onSelectPlace])

    if (!isLoaded) return <></>

    const handleSearchArea = () => {
        const bounds = map?.getBounds()?.toJSON()
        if (bounds) onSearchArea(bounds)
    }

    return (
        <div className="map-container">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                options={mapOptions}
                zoom={13}
                onLoad={setMap}
                onUnmount={() => setMap(null)}
                onIdle={onIdle}
                onClick={onMapClick}
            >
                {results.map((result, i) => {
                    const isSelected = selectedPlace?.google_place_id === result.google_place_id
                    const isHovered = hoveredResultId === result.id
                    return (
                        <MarkerF
                            key={result.id}
                            position={resultPosition(result)}
                            title={result.name}
                            icon={pinIcon(isSelected ? PIN_ACTIVE_COLOR : isHovered ? PIN_HOVER_COLOR : PIN_COLOR)}
                            label={{ text: String(i + 1), color: '#fff', fontSize: '10px', fontWeight: '900' }}
                            zIndex={isSelected ? 3 : isHovered ? 2 : 1}
                            onClick={() => onSelectResult(result)}
                            onMouseOver={() => onHoverResult(result.id)}
                            onMouseOut={() => onHoverResult(null)}
                        />
                    )
                })}

                {userPosition && (
                    <MarkerF
                        position={userPosition}
                        title="you are here"
                        clickable={false}
                        zIndex={0}
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: '#4285f4',
                            fillOpacity: 1,
                            strokeColor: '#fff',
                            strokeWeight: 2,
                        }}
                    />
                )}

                {selectedPlace && (
                    <InfoWindow
                        position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                        onCloseClick={() => onSelectPlace(null)}
                    >
                        <div><h3>{selectedPlace.name != null ? selectedPlace.name : selectedPlace.google_place_id}</h3></div>
                    </InfoWindow>
                )}
            </GoogleMap>

            {searchActive && movedSinceSearch && (
                <button type="button" className="map-float-btn search-area-btn" onClick={handleSearchArea}>
                    ⟳ search this area
                </button>
            )}

            {userPosition && (
                <button
                    type="button"
                    className="map-float-btn recenter-btn"
                    aria-label="Center map on my location"
                    title="center on my location"
                    onClick={() => map?.panTo(userPosition)}
                >
                    ◎
                </button>
            )}
        </div>
    )
}

export default MainMap
