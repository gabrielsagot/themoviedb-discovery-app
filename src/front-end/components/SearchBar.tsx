import { useEffect, useRef, useState } from 'react';

type SearchBarProps = {
  onSearch: (query: string) => void;
};

const DEBOUNCE_MS = 350;

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState('');

  // The debounce timer lives in a ref, started from the change/clear event
  // handlers below (a real user action), never from an effect. That's what
  // keeps it from ever firing on its own when the component just mounts.
  const timeoutRef = useRef<number | undefined>(undefined);

  // Clear any pending debounce timer if the component unmounts mid-wait.
  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  const scheduleSearch = (newValue: string) => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      onSearch(newValue.trim());
    }, DEBOUNCE_MS);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    scheduleSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    window.clearTimeout(timeoutRef.current);
    onSearch('');
  };

  return (
    <div className="search">
      <svg
        className="search__icon"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <line
          x1="13.7"
          y1="13.7"
          x2="18"
          y2="18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        className="search__input"
        placeholder="Rechercher un film"
        aria-label="Rechercher un film"
        value={value}
        onChange={handleChange}
      />
      {value && (
        <button
          type="button"
          className="search__clear"
          aria-label="Effacer la recherche"
          onClick={handleClear}
        >
          ×
        </button>
      )}
    </div>
  );
}
