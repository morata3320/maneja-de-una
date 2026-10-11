import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./ui/Icon";
import { api } from "../services/apiClient";
import { useAuth } from "../controllers/AuthContext";
interface Experience {
  favorites: string[];
  comparison: string[];
  toggleFavorite: (id: string) => void;
  toggleCompare: (id: string) => void;
  notify: (message: string) => void;
  isPublicationViewed: (publicationId: string | null) => boolean;
  markPublicationViewed: (
    vehicleId: string,
    publicationId: string | null,
  ) => void;
}
const Context = createContext<Experience | null>(null);
export function LocalExperience({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [comparison, setComparison] = useState<string[]>([]);
  const [viewedPublications, setViewedPublications] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      try {
        setViewedPublications(
          JSON.parse(
            localStorage.getItem("mdu_viewed_publications_visitor") ?? "[]",
          ) as string[],
        );
      } catch {
        setViewedPublications([]);
      }
      return;
    }
    api<Array<{ id: string }>>({ url: "/favorites" })
      .then((rows) => setFavorites(rows.map((row) => row.id)))
      .catch(() => undefined);
    api<{ publicationIds: string[] }>({
      url: "/vehicles/publication-views/me",
    })
      .then(({ publicationIds }) => setViewedPublications(publicationIds))
      .catch(() => setViewedPublications([]));
  }, [user]);
  function notify(text: string) {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }
  function toggleFavorite(id: string) {
    const active = favorites.includes(id);
    if (!user) {
      notify("Inicia sesión para guardar favoritos");
      return;
    }
    void api({ method: active ? "DELETE" : "POST", url: `/favorites/${id}` })
      .then(() => {
        setFavorites(
          active ? favorites.filter((v) => v !== id) : [...favorites, id],
        );
        notify(active ? "Quitado de favoritos" : "Agregado a favoritos");
      })
      .catch((error) =>
        notify(
          error instanceof Error ? error.message : "No se pudo actualizar",
        ),
      );
  }
  function toggleCompare(id: string) {
    if (comparison.includes(id))
      setComparison(comparison.filter((v) => v !== id));
    else if (comparison.length < 3) setComparison([...comparison, id]);
    else notify("Puedes comparar hasta 3 autos. Quita uno para añadir otro.");
  }
  function isPublicationViewed(publicationId: string | null) {
    return publicationId ? viewedPublications.includes(publicationId) : false;
  }
  function markPublicationViewed(
    vehicleId: string,
    publicationId: string | null,
  ) {
    if (!publicationId || viewedPublications.includes(publicationId)) return;
    setViewedPublications((current) => [...current, publicationId]);
    if (user) {
      void api({ method: "POST", url: `/vehicles/${vehicleId}/view` }).catch(
        () =>
          setViewedPublications((current) =>
            current.filter((id) => id !== publicationId),
          ),
      );
      return;
    }
    const next = [...viewedPublications, publicationId];
    localStorage.setItem(
      "mdu_viewed_publications_visitor",
      JSON.stringify(next),
    );
  }
  return (
    <Context.Provider
      value={{
        favorites,
        comparison,
        toggleFavorite,
        toggleCompare,
        notify,
        isPublicationViewed,
        markPublicationViewed,
      }}
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
