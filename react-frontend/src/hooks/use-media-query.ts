import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Update the state with the current match
    const updateMatch = () => setMatches(media.matches);

    // Set initial value
    updateMatch();

    // Listen for changes
    media.addEventListener("change", updateMatch);

    // Clean up the listener on unmount
    return () => media.removeEventListener("change", updateMatch);
  }, [query]);

  return matches;
}
