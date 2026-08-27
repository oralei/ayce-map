import { useEffect, useState } from 'react'
import axios from 'axios';
import './App.css'

function App() {
  const [data, setData] = useState<{ testVar: string } | null>(null)

  useEffect(() => {
    axios.get('http://localhost:8080/')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
  }, [])

  return (
    <div>
      <title>AYCE</title>
      <h1>hi</h1>
      <p>{data ? data.testVar : 'Loading...'}</p>
    </div>
  )
}

export default App