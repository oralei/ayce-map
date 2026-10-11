import axios from 'axios'
import type { PlaceResult } from './MainMap'
import type { TagChipData } from './tagCategories'
import type { TagOption } from './tagOptions'

export interface SearchFilters {
    query: string
    tags: TagOption[]
    minPrice: number | null
    maxPrice: number | null
}

export const EMPTY_FILTERS: SearchFilters = { query: '', tags: [], minPrice: null, maxPrice: null }

export function hasActiveFilters(filters: SearchFilters): boolean {
    return filters.query.length > 0 || filters.tags.length > 0 || filters.minPrice != null || filters.maxPrice != null
}

// shape of one row from GET /location/search
export interface SearchResult {
    id: string // bigint serialized as string — see prisma.ts BigInt.toJSON shim
    google_place_id: string
    name: string
    address: string | null
    latitude: string | number // Prisma serializes Decimal as a string
    longitude: string | number
    rating: string | number | null
    tags: TagChipData[]
    item_count: number
    price_min: number | null
    price_max: number | null
    matched_items: string[] // item names that matched the query or price range
}

export interface SearchResponse {
    total: number
    results: SearchResult[]
}

// `bounds` null searches every saved location regardless of map position
export function searchLocations(
    filters: SearchFilters,
    bounds: google.maps.LatLngBoundsLiteral | null
): Promise<SearchResponse> {
    return axios
        .get<SearchResponse>('http://localhost:8080/location/search', {
            params: {
                q: filters.query || undefined,
                tags: filters.tags.length > 0 ? filters.tags.map((t) => t.id).join(',') : undefined,
                min_price: filters.minPrice ?? undefined,
                max_price: filters.maxPrice ?? undefined,
                ...(bounds ?? {}),
            },
        })
        .then((res) => res.data)
}

export interface PriceRange {
    min: number | null
    max: number | null
}

export function fetchPriceRange(): Promise<PriceRange> {
    return axios.get<PriceRange>('http://localhost:8080/item/price-range').then((res) => res.data)
}

export function resultPosition(result: SearchResult): google.maps.LatLngLiteral {
    return { lat: Number(result.latitude), lng: Number(result.longitude) }
}

// RestaurantView looks a place up by google_place_id, so a saved result opens
// straight into the Manage view
export function toPlaceResult(result: SearchResult): PlaceResult {
    const { lat, lng } = resultPosition(result)
    return {
        id: result.google_place_id,
        google_place_id: result.google_place_id,
        name: result.name,
        address: result.address,
        lat,
        lng,
        tags: [],
        rating: null,
    }
}
