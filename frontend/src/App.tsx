import { useEffect, useState } from 'react'
import axios from 'axios';
import './App.css'
interface DemoRow {
  id: number
  name: string
}

function App() {
  const [data, setData] = useState<{ testVar: string } | null>(null)

  const [rows, setRows] = useState<DemoRow[]>([]) // array of interface DemoRow, default to empty array
  
  // idk what these for
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
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
    <div>
      <title>Ayce</title>
      <h1 className="font-bold">hi</h1>
      <p>{data ? data.testVar : 'Loading...'}</p>

      <h2 className="font-bold">Demo Table</h2>
      {loading && <p>Loading data...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              ID: {row.id} NAME: {row.name}
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}

export default App