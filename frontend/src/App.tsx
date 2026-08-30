import { useEffect, useState } from 'react'
import MainMap from './components/MainMap'
import type { PlaceResult } from './components/MainMap' // or wherever you export the interface from
import RestaurantView from './components/RestaurantView'
import axios from 'axios';
import './App.css'

interface DemoRow {
  name: string
  id: number
}

function App() {
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)

  const [data, setData] = useState<{ testVar: string } | null>(null)
  const [rows, setRows] = useState<DemoRow[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Ayce!";
    axios.get('http://localhost:8080/')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
  }, [])

  useEffect(() => {
    axios.get<DemoRow[]>('http://localhost:8080/fetchData')
      .then((res) => setRows(res.data))
      .catch((err) => {
        console.error(err)
        setError('Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="app">
      {/* 100vh Fullscreen Viewport */}
      <div className="viewport">
        <header className="app-header">
          <div className="logo">
            <span className="mark">Ayce!</span>
            <span className="tag">all you can eat</span>
          </div>
          <div className="search-wrap">
            <span className="glyph">▸</span>
            <input id="searchInput" type="text" placeholder="search a restaurant, tag, or item..."/>
          </div>
        </header>

        <div className="main">
          <MainMap onSelectPlace={setSelectedPlace} />
          <div className="info-wrap">
            <span className="panel-label">info ▸ location ▸ item</span>
            <div className="info-panel" id="infoPanel">
              <RestaurantView place={selectedPlace} />
            </div>
          </div>
        </div>
      </div>

      {/* Content below the fold */}
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
      </div>
    </div>
  )
}

export default App