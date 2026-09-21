import { useCallback, useEffect, useState } from "react"
import type { Movie } from "../back-end/schemas/MoviesTypes"
import MovieItem from "./components/MovieItem"
import "./index.css"

type LoadState = "loading" | "loaded" | "error"

export default function App() {
  // State to hold the fetched movies data, initialized to null
  const [movies, setMovies] = useState<Movie[] | null>(null)
  const [status, setStatus] = useState<LoadState>("loading")

  // Fetch popular movies. Only touches state from the promise callbacks,
  // never synchronously, so it stays safe to call from an effect.
  const loadMovies = useCallback(() => {
    fetch("/api/movies/popular")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch popular movies")
        }
        return response.json()
      })
      .then((data) => {
        setMovies(data.results)
        setStatus("loaded")
      })
      .catch(() => {
        setStatus("error")
      })
  }, [])

  // useEffect hook to fetch data from an API when the component mounts
  useEffect(() => {
    loadMovies()
  }, [loadMovies])

  // Retry is triggered by a click, so resetting to "loading" here is safe.
  const handleRetry = () => {
    setStatus("loading")
    loadMovies()
  }

  return (
    <main>
      <header className="hero">
        <h1 className="hero__title">Popular Movies</h1>
        <p className="hero__subtitle">
          The most popular movies right now, in one place.
        </p>
      </header>

      {status === "loading" && (
        <ul className="movie-grid" aria-busy="true" aria-label="Loading popular movies">
          {Array.from({ length: 10 }).map((_, index) => (
            <li className="movie" key={index}>
              <div className="skeleton-poster" />
              <div className="skeleton-line" style={{ width: "80%" }} />
              <div className="skeleton-line" style={{ width: "40%" }} />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <div className="error-state">
          <h2 className="error-state__title">Movies couldn't be loaded</h2>
          <p className="error-state__message">
            Something went wrong while fetching popular movies. Check that the
            server is running and try again.
          </p>
          <button className="error-state__retry" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}

      {status === "loaded" && movies && (
        <ul className="movie-grid">
          {movies.map((movie) => (
            <MovieItem key={movie.id} movie={movie} />
          ))}
        </ul>
      )}
    </main>
  )
}
