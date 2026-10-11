import Tag from '../Tag'
import type { SearchResponse, SearchResult } from '../search'

interface SearchResultsPanelProps {
    response: SearchResponse | null // null until the first response for this search arrives
    loading: boolean
    error: string | null
    /** true when the search wasn't limited to the map view */
    searchedEverywhere: boolean
    hoveredResultId: string | null
    onHoverResult: (id: string | null) => void
    onSelectResult: (result: SearchResult) => void
    onSearchEverywhere: () => void
}

function formatPriceRange(min: number | null, max: number | null): string | null {
    if (min == null || max == null) return null
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`
}

export function SearchResultsPanel({
    response,
    loading,
    error,
    searchedEverywhere,
    hoveredResultId,
    onHoverResult,
    onSelectResult,
    onSearchEverywhere,
}: SearchResultsPanelProps) {
    if (error) {
        return (
            <div className="restaurant-info-empty">
                <span className="empty-glyph select-none">▸</span>
                <p>{error}</p>
            </div>
        )
    }

    if (!response) {
        return (
            <div className="restaurant-info-empty">
                <span className="empty-glyph select-none">▸</span>
                <p>searching...</p>
            </div>
        )
    }

    if (response.results.length === 0) {
        return (
            <div className="restaurant-info-empty">
                <span className="empty-glyph select-none">▸</span>
                <p>{searchedEverywhere ? 'no saved places match these filters' : 'no saved places match in this area'}</p>
                {!searchedEverywhere && (
                    <button type="button" className="chip-toggle" onClick={onSearchEverywhere}>
                        search everywhere
                    </button>
                )}
            </div>
        )
    }

    const { total, results } = response

    return (
        <div className={`search-results${loading ? ' is-loading' : ''}`}>
            <div className="search-results-header">
                {total > results.length
                    ? `showing ${results.length} of ${total} — zoom in or refine filters`
                    : `${total} result${total === 1 ? '' : 's'}${searchedEverywhere ? '' : ' in this area'}`}
            </div>

            <ol className="search-results-list">
                {results.map((result, i) => {
                    const priceRange = formatPriceRange(result.price_min, result.price_max)
                    return (
                        <li key={result.id}>
                            <button
                                type="button"
                                className={`result-card${hoveredResultId === result.id ? ' is-active' : ''}`}
                                onClick={() => onSelectResult(result)}
                                onMouseEnter={() => onHoverResult(result.id)}
                                onMouseLeave={() => onHoverResult(null)}
                            >
                                <span className="result-badge select-none">{i + 1}</span>
                                <span className="result-body">
                                    <span className="result-title-row">
                                        <span className="result-name">{result.name}</span>
                                        {result.rating != null && (
                                            <span className="result-rating">★ {Number(result.rating)}</span>
                                        )}
                                    </span>
                                    {result.address != null && <span className="result-address">{result.address}</span>}
                                    <span className="result-meta">
                                        {result.item_count} item{result.item_count === 1 ? '' : 's'}
                                        {priceRange && ` · ${priceRange}`}
                                    </span>
                                    {result.matched_items.length > 0 && (
                                        <span className="result-matched">matched: {result.matched_items.join(', ')}</span>
                                    )}
                                    {result.tags.length > 0 && (
                                        <span className="location-tags-list">
                                            {result.tags.map((tag) => (
                                                <Tag key={tag.id} label={tag.label} category={tag.category} />
                                            ))}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}

export default SearchResultsPanel
