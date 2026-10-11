import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import MainMap from './components/MainMap'
import type { MainMapHandle, PlaceResult } from './components/MainMap'
import RestaurantView from './components/RestaurantView'
import SearchResultsPanel from './components/panels/SearchResultsPanel'
import TagPicker from './components/TagPicker'
import type { TagOption } from './components/tagOptions'
import {
  EMPTY_FILTERS,
  fetchPriceRange,
  hasActiveFilters,
  searchLocations,
  toPlaceResult,
  type PriceRange,
  type SearchFilters,
  type SearchResponse,
  type SearchResult,
} from './components/search'
import axios from 'axios';
import './App.css'

// '' clears the bound; anything that isn't a non-negative number is rejected
function parsePriceInput(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function App() {
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)

  // filters the current results were searched with, plus the inputs' drafts
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [queryInput, setQueryInput] = useState('')
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  // bounds the current results were limited to; null = searched everywhere
  const [searchedBounds, setSearchedBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hoveredResultId, setHoveredResultId] = useState<string | null>(null)

  const mapRef = useRef<MainMapHandle>(null)
  // bumped per search so responses that arrive out of order are dropped
  const searchRequestId = useRef(0)

  const searchActive = hasActiveFilters(filters)

  useEffect(() => {
    document.title = "Ayce!";
    axios.get('http://localhost:8080/')
    fetchPriceRange()
      .then(setPriceRange)
      .catch((err) => console.error(err))
  }, [])

  function runSearch(nextFilters: SearchFilters, bounds: google.maps.LatLngBoundsLiteral | null, fitResults = false) {
    const requestId = ++searchRequestId.current
    setSelectedPlace(null)
    setHoveredResultId(null)

    if (!hasActiveFilters(nextFilters)) {
      setSearchResponse(null)
      setSearchedBounds(null)
      setSearchLoading(false)
      setSearchError(null)
      return
    }

    setSearchedBounds(bounds)
    setSearchLoading(true)
    setSearchError(null)

    searchLocations(nextFilters, bounds)
      .then((res) => {
        if (requestId !== searchRequestId.current) return
        setSearchResponse(res)
        if (fitResults) mapRef.current?.fitResults(res.results)
      })
      .catch((err) => {
        if (requestId !== searchRequestId.current) return
        console.error(err)
        setSearchError("couldn't search — try again")
      })
      .finally(() => {
        if (requestId === searchRequestId.current) setSearchLoading(false)
      })
  }

  // Filter changes keep an "everywhere" search unbounded; otherwise they
  // search whatever the map is showing now.
  function applyFilters(nextFilters: SearchFilters) {
    setFilters(nextFilters)
    const keepEverywhere = searchActive && searchedBounds == null
    runSearch(nextFilters, keepEverywhere ? null : mapRef.current?.getBounds() ?? null)
  }

  function handleQueryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      applyFilters({ ...filters, query: queryInput.trim() })
    } else if (e.key === 'Escape') {
      setQueryInput('')
      if (filters.query) applyFilters({ ...filters, query: '' })
    }
  }

  function handleQueryChange(value: string) {
    setQueryInput(value)
    // emptying the box drops the text part of the search right away
    if (value === '' && filters.query) applyFilters({ ...filters, query: '' })
  }

  function handleAddTag(tag: TagOption) {
    if (filters.tags.some((t) => t.id === tag.id)) return
    applyFilters({ ...filters, tags: [...filters.tags, tag] })
  }

  function handleRemoveTag(tagId: string) {
    applyFilters({ ...filters, tags: filters.tags.filter((t) => t.id !== tagId) })
  }

  function commitPrices() {
    const minPrice = parsePriceInput(minPriceInput)
    const maxPrice = parsePriceInput(maxPriceInput)
    // reject bad input by snapping the box back to the applied value
    if (minPrice === undefined) setMinPriceInput(filters.minPrice?.toString() ?? '')
    if (maxPrice === undefined) setMaxPriceInput(filters.maxPrice?.toString() ?? '')

    const nextMin = minPrice === undefined ? filters.minPrice : minPrice
    const nextMax = maxPrice === undefined ? filters.maxPrice : maxPrice
    if (nextMin === filters.minPrice && nextMax === filters.maxPrice) return
    applyFilters({ ...filters, minPrice: nextMin, maxPrice: nextMax })
  }

  function handlePriceKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitPrices()
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS)
    setQueryInput('')
    setMinPriceInput('')
    setMaxPriceInput('')
    runSearch(EMPTY_FILTERS, null)
  }

  function handleSelectResult(result: SearchResult) {
    setSelectedPlace(toPlaceResult(result))
  }

  const results = searchActive ? searchResponse?.results ?? [] : []
  const showingResults = searchActive && selectedPlace == null

  return (
    <div className="app">
      {/* 100vh Fullscreen Viewport */}
      <div className="viewport">
        <header className="app-header">
          <div className="logo">
            <span className="mark">Ayce!</span>
          </div>
          <div className="search-wrap">
            <span className="glyph">▸</span>
            <input
              id="searchInput"
              type="search"
              placeholder="search a restaurant, tag, or item..."
              value={queryInput}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleQueryKeyDown}
            />
          </div>
        </header>

        <div className="filter-bar">
          <span className="filter-label">Filter</span>
          <div id="tagList" style={{ display: 'flex', gap: '8px', flex: '0 0 auto', alignItems: 'center' }}>
            {filters.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="chip-toggle on"
                title="remove filter"
                onClick={() => handleRemoveTag(tag.id)}
              >
                {tag.name} ×
              </button>
            ))}
            <TagPicker appliedTagIds={filters.tags.map((t) => t.id)} onSelect={handleAddTag} />
          </div>
          <span className="divider"></span>
          <span className="filter-label">price</span>
          <div id="priceList" style={{display:'flex', gap:'6px', flex: '0 0 auto', alignItems: 'center' }}>
            <span className="price-sign">$</span>
            <input
              className="price-input"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              aria-label="minimum item price"
              placeholder={priceRange?.min != null ? String(priceRange.min) : 'min'}
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              onBlur={commitPrices}
              onKeyDown={handlePriceKeyDown}
            />
            <span className="price-sep">–</span>
            <input
              className="price-input"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              aria-label="maximum item price"
              placeholder={priceRange?.max != null ? String(priceRange.max) : 'max'}
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              onBlur={commitPrices}
              onKeyDown={handlePriceKeyDown}
            />
          </div>
          <button
            className={`clear-btn${searchActive ? ' show' : ''}`}
            id="clearBtn"
            onClick={handleClear}
          >
            clear filters
          </button>
        </div>


        <div className="main">
          <MainMap
            ref={mapRef}
            selectedPlace={selectedPlace}
            onSelectPlace={setSelectedPlace}
            results={results}
            hoveredResultId={hoveredResultId}
            onHoverResult={setHoveredResultId}
            onSelectResult={handleSelectResult}
            searchActive={searchActive}
            searchedBounds={searchedBounds}
            onSearchArea={(bounds) => runSearch(filters, bounds)}
          />
          <div className="info-wrap">
            <span className="panel-label select-none">
              info
              {searchActive && (
                <>
                  {' ▸ '}
                  {selectedPlace ? (
                    <button type="button" className="breadcrumb-link" onClick={() => setSelectedPlace(null)}>
                      results
                    </button>
                  ) : (
                    'results'
                  )}
                </>
              )}
              {selectedPlace && <span className="breadcrumb-place">{' ▸ '}{selectedPlace.name}</span>}
            </span>
            <div className="info-panel" id="infoPanel">
              {showingResults ? (
                <SearchResultsPanel
                  response={searchResponse}
                  loading={searchLoading}
                  error={searchError}
                  searchedEverywhere={searchedBounds == null}
                  hoveredResultId={hoveredResultId}
                  onHoverResult={setHoveredResultId}
                  onSelectResult={handleSelectResult}
                  onSearchEverywhere={() => runSearch(filters, null, true)}
                />
              ) : (
                <>
                  {searchActive && (
                    <button type="button" className="back-to-results" onClick={() => setSelectedPlace(null)}>
                      ◂ back to results
                    </button>
                  )}
                  <RestaurantView place={selectedPlace} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content below the fold


      const [rows, setRows] = useState<DemoRow[]>([])

      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<string | null>(null)

      <div className="below-viewport">
        <h1 className="font-bold">Backend Testing</h1>
        <p className="mb-4">{data ? data.testVar : 'Loading test var...'}</p>

        <div className="extras">
          <h2 className="font-bold">Demo Table</h2>
          {loading && <p>Loading table rows...</p>}
          {error && <p className="text-red-500">{error}</p>}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !error && rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  )
}

export default App
