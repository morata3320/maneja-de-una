import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./ui/Icon";
interface Experience {
  favorites: string[];
  comparison: string[];
  toggleFavorite: (id: string) => void;
  toggleCompare: (id: string) => void;
  notify: (message: string) => void;
}
const Context = createContext<Experience | null>(null);
export function LocalExperience({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState([
    "toyota-rav4",
    "mazda-3",
    "ford-ranger",
  ]);
  const [comparison, setComparison] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function notify(text: string) {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }
  function toggleFavorite(id: string) {
    const active = favorites.includes(id);
    setFavorites(
      active ? favorites.filter((v) => v !== id) : [...favorites, id],
    );
    notify(active ? "Quitado de favoritos" : "Agregado a favoritos");
  }
  function toggleCompare(id: string) {
    if (comparison.includes(id))
      setComparison(comparison.filter((v) => v !== id));
    else if (comparison.length < 3) setComparison([...comparison, id]);
    else notify("Puedes comparar hasta 3 autos. Quita uno para añadir otro.");
  }
  return (
    <Context.Provider
      value={{ favorites, comparison, toggleFavorite, toggleCompare, notify }}
    >
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message && (
          <>
            <Icon name="check" />
            {message}
          </>
        )}
      </div>
    </Context.Provider>
  );
}
export function useExperience() {
  const value = useContext(Context);
  if (!value) throw new Error("Falta LocalExperience");
  return value;
}
