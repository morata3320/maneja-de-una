import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/apiClient";
import { Button, Input, Select } from "../ui";
import { Icon } from "../ui/Icon";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate(),
    [params] = useSearchParams();
  const [place, setPlace] = useState(params.get("location") ?? ""),
    [search, setSearch] = useState(params.get("search") ?? "");
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  useEffect(() => {
    api<{ data: Array<{ id: string; name: string }> }>({
      url: "/locations?limit=100",
    })
      .then((result) => setLocations(result.data))
      .catch(() => setLocations([]));
  }, []);
  return (
    <form
      className={`search-bar ${compact ? "compact" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const query = new URLSearchParams();
        if (place) query.set("location", place);
        if (search) query.set("search", search);
        navigate(`/vehiculos?${query}`);
      }}
    >
      <div className="search-place">
        <Icon name="pin" />
        <Select
          label="Ubicación"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
        >
          <option value="">Todas las ubicaciones</option>
          {locations.map((location) => (
            <option key={location.id} value={location.name}>
              {location.name}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="¿Qué auto buscas?"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Marca o modelo"
      />
      <Button size="lg" type="submit">
        <Icon name="search" />
        Buscar autos
      </Button>
    </form>
  );
}
