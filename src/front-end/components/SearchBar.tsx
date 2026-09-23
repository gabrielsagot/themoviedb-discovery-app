import { useEffect, useRef, useState } from 'react';

type SearchBarProps = {
  onSearch: (query: string) => void;
  /** Query already present in the URL when the bar first mounts. */
  initialQuery?: string;
};

const DEBOUNCE_MS = 350;

export default function SearchBar({
  onSearch,
  initialQuery = '',
}: SearchBarProps) {
  const [value, setValue] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The debounce timer lives in a ref, started from the change/clear event
  // handlers below (a real user action), never from an effect. That's what
  // keeps it from ever firing on its own when the component just mounts.
  const timeoutRef = useRef<number | undefined>(undefined);

  // Clear any pending debounce timer if the component unmounts mid-wait.
  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  // "/" jumps straight to the search field, the way it does in most tools
  // people already use — unless they're currently typing somewhere else.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;

      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (isTyping) return;

      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
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
    inputRef.current?.focus();
  };

  // Escape clears the field when there's something in it, and steps out of
  // the search altogether when there isn't.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;

    if (value) {
      handleClear();
    } else {
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`search${isFocused ? ' search--focused' : ''}`}>
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
        ref={inputRef}
        type="search"
        className="search__input"
        placeholder="Rechercher un film"
        aria-label="Rechercher un film"
        aria-keyshortcuts="/"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {value ? (
        <button
          type="button"
          className="search__clear"
          aria-label="Effacer la recherche"
          onClick={handleClear}
        >
          ×
        </button>
      ) : (
        !isFocused && (
          <kbd className="search__hint" aria-hidden="true">
            /
          </kbd>
        )
      )}
    </div>
  );
}
