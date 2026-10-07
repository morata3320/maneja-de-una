import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from "../components/ui";
import { api } from "../services/apiClient";

type Row = Record<string, unknown>;
type Page = { data: Row[]; total?: number; page?: number; limit?: number };
type Option = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "select";
  required?: boolean;
  options?: Option[];
  relation?: string;
  min?: number;
  max?: number;
};
const yesNo: Option[] = [
  { value: "true", label: "Activo" },
  { value: "false", label: "Inactivo" },
];
const choices = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
const configurations: Record<string, { columns: string[]; fields: Field[] }> = {
  brands: {
    columns: ["name", "active"],
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  "vehicle-models": {
    columns: ["name", "brandId", "active"],
    fields: [
      { key: "name", label: "Modelo", required: true },
      {
        key: "brandId",
        label: "Marca",
        type: "select",
        relation: "brands",
        required: true,
      },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  categories: {
    columns: ["name", "description", "active"],
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción" },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  locations: {
    columns: ["name", "city", "province", "active"],
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "city", label: "Ciudad", required: true },
      { key: "province", label: "Provincia", required: true },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  suppliers: {
    columns: ["name", "active"],
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  depots: {
    columns: ["name", "supplierId", "locationId", "airport", "active"],
    fields: [
      { key: "name", label: "Agencia", required: true },
      {
        key: "supplierId",
        label: "Proveedor",
        type: "select",
        relation: "suppliers",
        required: true,
      },
      {
        key: "locationId",
        label: "Ubicación",
        type: "select",
        relation: "locations",
        required: true,
      },
      { key: "airport", label: "Código aeropuerto" },
      { key: "cityId", label: "ID ciudad", type: "number", required: true },
      { key: "latitude", label: "Latitud", type: "number", required: true },
      { key: "longitude", label: "Longitud", type: "number", required: true },
      { key: "active", label: "Estado", type: "select", options: yesNo },
    ],
  },
  "depot-scores": {
    columns: ["depotId", "score"],
    fields: [
      {
        key: "depotId",
        label: "Agencia",
        type: "select",
        relation: "depots",
        required: true,
      },
      {
        key: "score",
        label: "Calificación",
        type: "number",
        min: 0,
        max: 10,
        required: true,
      },
    ],
  },
  users: {
    columns: [
      "firstName",
      "lastName",
      "email",
      "cedula",
      "phone",
      "role",
      "status",
      "createdAt",
    ],
    fields: [
      { key: "firstName", label: "Nombres", required: true },
      { key: "lastName", label: "Apellidos", required: true },
      { key: "email", label: "Correo", type: "email", required: true },
      { key: "cedula", label: "Cédula", required: true },
      { key: "phone", label: "Teléfono", required: true },
      { key: "password", label: "Contraseña", type: "password" },
      {
        key: "role",
        label: "Rol",
        type: "select",
        options: choices(["USER", "ADMIN"]),
      },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: choices(["ACTIVE", "INACTIVE", "SUSPENDED"]),
      },
    ],
  },
  vehicles: {
    columns: [
      "brand",
      "model",
      "category",
      "location",
      "supplier",
      "licensePlate",
      "pricePerDay",
      "status",
    ],
    fields: [
      {
        key: "brandId",
        label: "Marca",
        type: "select",
        relation: "brands",
        required: true,
      },
      {
        key: "modelId",
        label: "Modelo",
        type: "select",
        relation: "vehicle-models",
        required: true,
      },
      {
        key: "categoryId",
        label: "Categoría",
        type: "select",
        relation: "categories",
        required: true,
      },
      {
        key: "locationId",
        label: "Ubicación",
        type: "select",
        relation: "locations",
        required: true,
      },
      {
        key: "supplierId",
        label: "Proveedor",
        type: "select",
        relation: "suppliers",
        required: true,
      },
      {
        key: "depotId",
        label: "Agencia",
        type: "select",
        relation: "depots",
        required: true,
      },
      { key: "year", label: "Año", type: "number", min: 1886, required: true },
      { key: "color", label: "Color", required: true },
      { key: "licensePlate", label: "Placa", required: true },
      {
        key: "transmission",
        label: "Transmisión",
        type: "select",
        options: choices(["MANUAL", "AUTOMATIC"]),
        required: true,
      },
      {
        key: "fuelType",
        label: "Combustible",
        type: "select",
        options: choices(["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"]),
        required: true,
      },
      {
        key: "seats",
        label: "Asientos",
        type: "number",
        min: 1,
        required: true,
      },
      {
        key: "doors",
        label: "Puertas",
        type: "number",
        min: 1,
        required: true,
      },
      {
        key: "bagCapacity",
        label: "Maletas",
        type: "number",
        min: 0,
        required: true,
      },
      {
        key: "pricePerDay",
        label: "Precio por día",
        type: "number",
        min: 0.01,
        required: true,
      },
      {
        key: "mileage",
        label: "Kilometraje",
        type: "number",
        min: 0,
        required: true,
      },
      { key: "description", label: "Descripción", required: true },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: choices([
          "AVAILABLE",
          "RESERVED",
          "RENTED",
          "MAINTENANCE",
          "INACTIVE",
        ]),
        required: true,
      },
      { key: "active", label: "Activo", type: "select", options: yesNo },
    ],
  },
};
const labels: Record<string, string> = {
  firstName: "Nombres",
  lastName: "Apellidos",
  createdAt: "Creado",
  brandId: "Marca",
  supplierId: "Proveedor",
  locationId: "Ubicación",
  depotId: "Agencia",
  pricePerDay: "Precio/día",
  licensePlate: "Placa",
  paymentReference: "Referencia",
  reservationId: "Reserva",
  cardBrand: "Marca",
  cardLast4: "Últimos 4",
  totalAmount: "Total",
  startsAt: "Inicio",
  endsAt: "Fin",
  paymentStatus: "Pago",
  customerName: "Cliente",
  vehicleName: "Vehículo",
  pickupLocation: "Lugar",
};
const idOf = (row: Row) => String(row.id ?? row.depotId ?? "");
const display = (value: unknown) =>
  value === true
    ? "Sí"
    : value === false
      ? "No"
      : value == null
        ? "—"
        : String(value);

function useCollection(url: string) {
  const [result, setResult] = useState<Page>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<Page | Row[]>({ url });
      setResult(
        Array.isArray(value) ? { data: value, total: value.length } : value,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar los datos",
      );
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);
  return { ...result, loading, error, load };
}

export function AdminDashboardApi() {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Row>({ url: "/admin/dashboard" })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);
  const metrics = [
    ["Vehículos", "totalVehicles"],
    ["Disponibles", "availableVehicles"],
    ["Reservados", "reservedVehicles"],
    ["Clientes", "customers"],
    ["Reservas activas", "activeReservations"],
    ["Confirmadas", "confirmedReservations"],
    ["Canceladas", "cancelledReservations"],
    ["Pagos aprobados", "approvedPayments"],
    ["Ingresos simulados", "simulatedRevenue"],
  ];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Datos reales de la operación."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Cargando…</p>
      ) : (
        <div className="kpi-grid">
          {metrics.map(([label, key]) => (
            <Card className="kpi" key={key}>
              <div>{label}</div>
              <strong>
                {key === "simulatedRevenue"
                  ? `$${Number(data[key]).toFixed(2)}`
                  : display(data[key])}
              </strong>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function RelationSelect({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data } = useCollection(`/${field.relation}?page=1&limit=100`);
  return (
    <Select
      label={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    >
      <option value="">Selecciona…</option>
      {data.map((row) => (
        <option key={idOf(row)} value={idOf(row)}>
          {display(row.name ?? row.airport ?? row.depotId)}
        </option>
      ))}
    </Select>
  );
}

function ResourceForm({
  resource,
  row,
  onSaved,
  onClose,
}: {
  resource: string;
  row: Row | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const config = configurations[resource];
  const [values, setValues] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of config.fields)
      next[field.key] =
        row?.[field.key] == null
          ? field.key === "active"
            ? "true"
            : ""
          : String(row[field.key]);
    setValues(next);
  }, [config.fields, row]);
  const change = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data: Row = {};
    for (const field of config.fields) {
      const value = values[field.key];
      if (field.key === "password" && row && !value) continue;
      if (value === "" && !field.required) continue;
      data[field.key] =
        field.type === "number"
          ? Number(value)
          : field.key === "active"
            ? value === "true"
            : value;
    }
    try {
      await api({
        method: row ? "PATCH" : "POST",
        url: row ? `/${resource}/${idOf(row)}` : `/${resource}`,
        data,
      });
      onSaved();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No fue posible guardar",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="stack" onSubmit={save}>
      {config.fields.map((field) =>
        field.relation ? (
          <RelationSelect
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            onChange={(value) => change(field.key, value)}
          />
        ) : field.type === "select" ? (
          <Select
            key={field.key}
            label={field.label}
            value={values[field.key] ?? ""}
            onChange={(e) => change(field.key, e.target.value)}
            required={field.required}
          >
            <option value="">Selecciona…</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            key={field.key}
            label={field.label}
            type={field.type ?? "text"}
            value={values[field.key] ?? ""}
            onChange={(e) => change(field.key, e.target.value)}
            required={field.required || (field.key === "password" && !row)}
            min={field.min}
            max={field.max}
            step={field.type === "number" ? "any" : undefined}
          />
        ),
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="inline-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function CrudCollection({
  resource,
  title,
}: {
  resource: string;
  title: string;
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Row | null | undefined>(undefined),
    [message, setMessage] = useState("");
  const query = useMemo(
    () =>
      `/${resource}?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    [resource, page, search],
  );
  const { data, total = 0, loading, error, load } = useCollection(query),
    config = configurations[resource];
  async function remove(row: Row) {
    if (
      !window.confirm(
        "¿Confirmas que deseas eliminar o desactivar este registro?",
      )
    )
      return;
    try {
      await api({ method: "DELETE", url: `/${resource}/${idOf(row)}` });
      setMessage("Registro actualizado correctamente.");
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No fue posible completar la acción",
      );
    }
  }
  return (
    <>
      <PageHeader
        title={title}
        description="Gestión conectada a API V2."
        action={
          <Button onClick={() => setEditing(null)}>Nuevo registro</Button>
        }
      />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Buscar"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <span>{total} registros</span>
        </div>
        {loading ? (
          <p role="status">Cargando…</p>
        ) : data.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column}>{labels[column] ?? column}</th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={idOf(row)}>
                    {config.columns.map((column) => (
                      <td key={column}>{display(row[column])}</td>
                    ))}
                    <td>
                      <div className="table-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(row)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void remove(row)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay registros." />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <div className="table-footer">
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="ghost"
            disabled={page * 10 >= total}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Card>
      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Editar registro" : "Nuevo registro"}
      >
        {editing !== undefined && (
          <ResourceForm
            resource={resource}
            row={editing}
            onSaved={() => void load()}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </>
  );
}

function ReservationsAdmin() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [message, setMessage] = useState("");
  const url = `/reservations?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`;
  const { data, total = 0, loading, error, load } = useCollection(url),
    columns = [
      "id",
      "customerName",
      "vehicleName",
      "startsAt",
      "endsAt",
      "pickupLocation",
      "totalAmount",
      "status",
      "paymentStatus",
      "createdAt",
    ];
  const reservationValue = (row: Row, column: string) => {
    const value = row[column];
    if (column === "status")
      return (
        (
          {
            PENDING: "Pendiente",
            CONFIRMED: "Confirmada",
            CANCELLED: "Cancelada",
            COMPLETED: "Completada",
          } as Record<string, string>
        )[String(value)] ?? display(value)
      );
    if (["startsAt", "endsAt", "createdAt"].includes(column) && value)
      return new Date(String(value)).toLocaleString();
    if (column === "totalAmount" && value != null)
      return `$${Number(value).toFixed(2)}`;
    return display(value);
  };
  async function cancel(row: Row) {
    if (!confirm("¿Cancelar esta reserva?")) return;
    try {
      await api({ method: "POST", url: `/reservations/${row.id}/cancel` });
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "No fue posible cancelar",
      );
    }
  }
  return (
    <>
      <PageHeader title="Reservas" description="Operación real de reservas." />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {choices(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]).map(
              ({ value }) => (
                <option key={value}>{value}</option>
              ),
            )}
          </Select>
        </div>
        {loading ? (
          <p role="status">Cargando…</p>
        ) : error ? (
          <div className="error-state" role="alert">
            <p className="form-error">{error}</p>
            <Button onClick={() => void load()}>Reintentar</Button>
          </div>
        ) : data.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{labels[column] ?? column}</th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={String(row.id)}>
                    {columns.map((column) => (
                      <td key={column}>{reservationValue(row, column)}</td>
                    ))}
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(row)}
                      >
                        Ver
                      </Button>
                      {["PENDING", "CONFIRMED"].includes(
                        String(row.status),
                      ) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancel(row)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay reservas." />
        )}
        {message && <p role="status">{message}</p>}
        <div className="table-footer">
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span>{total} reservas</span>
          <Button
            variant="ghost"
            disabled={page * 10 >= total}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Card>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalle de reserva"
      >
        {selected &&
          columns.map((key) => (
            <p key={key}>
              <strong>{labels[key] ?? key}:</strong>{" "}
              {reservationValue(selected, key)}
            </p>
          ))}
      </Modal>
    </>
  );
}

function PaymentsAdmin() {
  const { data, loading, error } = useCollection("/payments"),
    columns = [
      "paymentReference",
      "reservationId",
      "customer",
      "amount",
      "currency",
      "status",
      "method",
      "brand",
      "last4",
      "createdAt",
    ];
  return (
    <>
      <PageHeader
        title="Pagos"
        description="Consulta operacional de pagos simulados; vista de solo lectura."
      />
      <Card>
        {loading ? (
          <p role="status">Cargando…</p>
        ) : data.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{labels[column] ?? column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={String(row.paymentReference)}>
                    {columns.map((column) => (
                      <td key={column}>{display(row[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay pagos." />
        )}
        {error && <p className="form-error">{error}</p>}
      </Card>
    </>
  );
}

export function AdminApiCollection({
  resource,
  title,
}: {
  resource: string;
  title: string;
  create?: boolean;
  action?: "cancel";
}) {
  if (resource === "reservations") return <ReservationsAdmin />;
  if (resource === "payments") return <PaymentsAdmin />;
  return <CrudCollection resource={resource} title={title} />;
}
