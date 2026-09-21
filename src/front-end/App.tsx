import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    // fetch data from an API /api/movies/popular
    fetch('/api/movies/popular')
      .then((response) => response.json())
      .then((data) => {
        console.log(data)
      })
  }, [])

  return (
    <div>
      Hello Vite from React!
    </div>
  )
}
