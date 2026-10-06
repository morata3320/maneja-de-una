import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { locations } from "../../mocks/locations";
import { Button, Input, Select } from "../ui";
import { Icon } from "../ui/Icon";
export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [place, setPlace] = useState(params.get("lugar") ?? "Quito");
  const [start, setStart] = useState(params.get("recogida") ?? "2026-10-12");
  const [end, setEnd] = useState(params.get("devolucion") ?? "2026-10-15");
  const [time, setTime] = useState(params.get("hora") ?? "10:00");
  const [returnTime, setReturnTime] = useState(
    params.get("horaDevolucion") ?? "10:00",
  );
  return (
    <form
      className={`search-bar ${compact ? "compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(
          `/vehiculos?${new URLSearchParams({ lugar: place, recogida: start, devolucion: end, hora: time, horaDevolucion: returnTime })}`,
        );
      }}
    >
      <div className="search-place">
        <Icon name="pin" />
        <Select
          label="Lugar de recogida"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
      </div>
      <div className="date-group">
        <Input
          label="Recogida"
          type="date"
          value={start}
          required
          onChange={(e) => {
            setStart(e.target.value);
            if (e.target.value >= end) setEnd("");
          }}
        />
        <Input
          label="Hora"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>
      <div className="date-group">
        <Input
          label="Devolución"
          type="date"
          min={start}
          value={end}
          required
          onChange={(e) => setEnd(e.target.value)}
        />
        <Input
          label="Hora"
          type="time"
          value={returnTime}
          onChange={(e) => setReturnTime(e.target.value)}
          required
        />
      </div>
      <Button size="lg" type="submit">
        <Icon name="search" />
        Buscar autos
      </Button>
    </form>
  );
}
