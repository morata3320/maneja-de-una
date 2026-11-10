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
import { Icon } from "../components/ui/Icon";
import { api } from "../services/apiClient";
import {
  getVehicleImage,
  getVehiclePlaceholder,
} from "../controllers/useVehiclesController";

type Row = Record<string, unknown>;
type Page = { data: Row[]; total?: number; page?: number; limit?: number };
type Option = { value: string; label: string };
type DeliveryFormState = {
  row: Row;
  detail: Row;
  loading: boolean;
  submitting: boolean;
  error: string;
  license: string;
  mileage: string;
  operator: string;
  observations: string;
};
type ReturnFormState = {
  row: Row;
  detail: Row;
  loading: boolean;
  submitting: boolean;
  error: string;
  mileage: string;
  fuel: string;
  observations: string;
};
type CatalogCreationState = {
  kind: "brand" | "model";
  name: string;
  saving: boolean;
  error: string;
  brandId?: string;
};
const preferredVehicleModelNames = ["Corolla", "RAV4", "Hilux", "Yaris"];
const autosV3Base = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v2"
)
  .replace(/\/$/, "")
  .replace(/\/api\/v2$/, "/api/v3");
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "select";
  required?: boolean;
  options?: Option[];
  relation?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  placeholder?: string;
  hint?: string;
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
      "image",
      "brand",
      "model",
      "category",
      "location",
      "supplier",
      "licensePlate",
      "pricePerDay",
      "stockTotal",
      "stockAvailable",
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
        hint: "Las opciones dependen de la marca seleccionada.",
      },
      {
        key: "categoryId",
        label: "Categoría",
        type: "select",
        relation: "categories",
        required: true,
        hint: "Selecciona la categoría registrada para el vehículo.",
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
        hint: "Las agencias dependen del proveedor seleccionado.",
      },
      {
        key: "year",
        label: "Año",
        type: "number",
        min: 1886,
        required: true,
        placeholder: "2024",
      },
      { key: "color", label: "Color", required: true, placeholder: "Blanco" },
      {
        key: "licensePlate",
        label: "Placa",
        required: true,
        placeholder: "PBA-1234",
      },
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
        placeholder: "5",
      },
      {
        key: "doors",
        label: "Puertas",
        type: "number",
        min: 1,
        required: true,
        placeholder: "4",
      },
      {
        key: "bagCapacity",
        label: "Maletas",
        type: "number",
        min: 0,
        max: 1000,
        integer: true,
        required: true,
        placeholder: "2",
      },
      {
        key: "pricePerDay",
        label: "Precio por día",
        type: "number",
        min: 0.01,
        required: true,
        placeholder: "45.00",
      },
      {
        key: "mileage",
        label: "Kilometraje",
        type: "number",
        min: 0,
        required: true,
        placeholder: "15000",
      },
      {
        key: "quantity",
        label: "Cantidad / Stock",
        type: "number",
        min: 0,
        required: true,
        placeholder: "1",
      },
      {
        key: "description",
        label: "Descripción",
        required: true,
        placeholder: "Sedán automático de 5 pasajeros",
      },
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
const vehicleFieldGroups = [
  {
    title: "Identificación y clasificación",
    description: "Datos principales con los que se identifica el vehículo.",
    keys: ["brandId", "modelId", "categoryId", "year", "color", "licensePlate"],
  },
  {
    title: "Ubicación y operación",
    description: "Define dónde opera el vehículo y su estado actual.",
    keys: ["supplierId", "depotId", "locationId", "status", "active"],
  },
  {
    title: "Características técnicas",
    description: "Capacidad y especificaciones para mostrar en el catálogo.",
    keys: [
      "transmission",
      "fuelType",
      "seats",
      "doors",
      "bagCapacity",
      "mileage",
    ],
  },
  {
    title: "Tarifa e inventario",
    description: "Precio, cantidad disponible y descripción comercial.",
    keys: ["pricePerDay", "quantity", "description"],
  },
] as const;
const labels: Record<string, string> = {
  image: "Imagen",
  firstName: "Nombres",
  lastName: "Apellidos",
  createdAt: "Creado",
  brandId: "Marca",
  supplierId: "Proveedor",
  locationId: "Ubicación",
  depotId: "Agencia",
  pricePerDay: "Precio/día",
  stockTotal: "Stock total",
  stockAvailable: "Disponibles",
  licensePlate: "Placa",
  paymentReference: "Referencia",
  reservationId: "Reserva",
  cardBrand: "Marca",
  cardLast4: "Últimos 4",
  totalAmount: "Total",
  startsAt: "Inicio",
  endsAt: "Fin",
  paymentStatus: "Pago",
  locator: "Código de reserva",
  customerName: "Cliente",
  vehicleName: "Vehículo",
  pickupLocation: "Lugar",
  digitalCheckinAt: "Check-in digital",
  deliveredAt: "Entregado",
  bookingClientId: "Cliente Booking",
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

const tableCell = (resource: string, row: Row, column: string) => {
  if (
    resource === "vehicles" &&
    column === "image" &&
    typeof row.brand === "string" &&
    typeof row.model === "string"
  )
    return (
      <img
        className="admin-vehicle-image"
        src={getVehicleImage(row.brand, row.model)}
        alt={`${row.brand} ${row.model}`}
        loading="lazy"
        onError={(event) => {
          const fallback = getVehiclePlaceholder("Sedan");
          if (event.currentTarget.src.endsWith(fallback)) return;
          event.currentTarget.src = fallback;
        }}
      />
    );
  return display(row[column]);
};

function useCollection(url: string) {
  const [result, setResult] = useState<Page>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
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
    },
    [url],
  );
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
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
  values,
  onChange,
  describedBy,
  additionalOptions = [],
}: {
  field: Field;
  value: string;
  values: Record<string, string>;
  onChange: (value: string, selected?: Row) => void;
  describedBy?: string;
  additionalOptions?: Row[];
}) {
  const { data } = useCollection(`/${field.relation}?page=1&limit=100`);
  const availableData = useMemo(() => {
    const rows = new Map<string, Row>();
    for (const row of [...data, ...additionalOptions]) rows.set(idOf(row), row);
    return [...rows.values()];
  }, [additionalOptions, data]);
  const parentMissing =
    (field.key === "modelId" && !values.brandId) ||
    (field.key === "depotId" && !values.supplierId);
  const options = availableData.filter((row) => {
    if (field.key === "modelId")
      return String(row.brandId ?? "") === values.brandId;
    if (field.key === "depotId")
      return String(row.supplierId ?? "") === values.supplierId;
    return true;
  });
  return (
    <Select
      label={field.label}
      value={value}
      disabled={parentMissing}
      onChange={(e) =>
        onChange(
          e.target.value,
          options.find((row) => idOf(row) === e.target.value),
        )
      }
      required={field.required}
      aria-describedby={describedBy}
    >
      <option value="">
        {parentMissing
          ? field.key === "modelId"
            ? "Selecciona primero una marca"
            : "Selecciona primero un proveedor"
          : options.length
            ? "Selecciona…"
            : "No hay opciones compatibles"}
      </option>
      {options.map((row) => (
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
    [error, setError] = useState(""),
    [catalogCreation, setCatalogCreation] =
      useState<CatalogCreationState | null>(null),
    [catalogNotice, setCatalogNotice] = useState(""),
    [additionalOptions, setAdditionalOptions] = useState<Record<string, Row[]>>(
      {},
    );
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
  const change = (key: string, value: string, selected?: Row) =>
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "brandId" && value !== current.brandId) next.modelId = "";
      if (key === "supplierId" && value !== current.supplierId)
        next.depotId = "";
      if (key === "depotId" && selected?.locationId)
        next.locationId = String(selected.locationId);
      return next;
    });
  const openCatalogCreation = (kind: "brand" | "model") => {
    setCatalogNotice("");
    if (kind === "model" && !values.brandId) {
      setError("Selecciona una marca antes de crear un modelo.");
      return;
    }
    setError("");
    setCatalogCreation({ kind, name: "", saving: false, error: "" });
  };
  const addRelationOption = (relation: string, row: Row) =>
    setAdditionalOptions((currentOptions) => ({
      ...currentOptions,
      [relation]: [...(currentOptions[relation] ?? []), row],
    }));
  const ensureReferenceModels = async (brandId: string) => {
    const current = await api<Page | Row[]>({
      url: "/vehicle-models?page=1&limit=100",
    });
    const rows = Array.isArray(current) ? current : current.data;
    const catalogNames = [
      ...new Set(
        rows
          .map((item) => String(item.name ?? "").trim())
          .filter((name) => name && !/(prueba|test|mdu)/i.test(name)),
      ),
    ];
    const preferred = preferredVehicleModelNames.filter((name) =>
      catalogNames.some(
        (catalogName) =>
          catalogName.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    );
    const alternatives = catalogNames.filter(
      (name) =>
        !preferred.some(
          (preferredName) =>
            preferredName.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ),
    );
    const selectedNames = [...preferred, ...alternatives].slice(0, 4);
    if (selectedNames.length < 4)
      throw new Error(
        "El catálogo no contiene cuatro nombres de modelos reales disponibles.",
      );
    const associated: Row[] = [];
    for (const name of selectedNames) {
      const existing = rows.find(
        (item) =>
          String(item.brandId ?? "") === brandId &&
          String(item.name ?? "")
            .trim()
            .toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (existing) {
        associated.push(existing);
        addRelationOption("vehicle-models", existing);
        continue;
      }
      const created = await api<Row>({
        method: "POST",
        url: "/vehicle-models",
        data: { name, brandId, active: true },
      });
      rows.push(created);
      associated.push(created);
      addRelationOption("vehicle-models", created);
    }
    return associated.map((item) => String(item.name));
  };
  const createCatalogEntry = async () => {
    if (!catalogCreation) return;
    const name = catalogCreation.name.trim();
    if (!name) {
      setCatalogCreation((current) =>
        current ? { ...current, error: "El nombre es obligatorio." } : current,
      );
      return;
    }
    const relation =
      catalogCreation.kind === "brand" ? "brands" : "vehicle-models";
    setCatalogCreation((current) =>
      current ? { ...current, saving: true, error: "" } : current,
    );
    try {
      if (catalogCreation.kind === "brand" && catalogCreation.brandId) {
        const assignedNames = await ensureReferenceModels(
          catalogCreation.brandId,
        );
        setCatalogNotice(
          `Marca “${name}” lista con los modelos ${assignedNames.join(", ")}.`,
        );
        setCatalogCreation(null);
        return;
      }
      const current = await api<Page | Row[]>({
        url: `/${relation}?page=1&limit=100`,
      });
      const rows = Array.isArray(current) ? current : current.data;
      const duplicate = rows.some(
        (item) =>
          String(item.name ?? "")
            .trim()
            .toLocaleLowerCase() === name.toLocaleLowerCase() &&
          (catalogCreation.kind === "brand" ||
            String(item.brandId ?? "") === values.brandId),
      );
      if (duplicate) {
        setCatalogCreation((currentState) =>
          currentState
            ? {
                ...currentState,
                saving: false,
                error:
                  catalogCreation.kind === "brand"
                    ? "Ya existe una marca con ese nombre."
                    : "Ya existe ese modelo para la marca seleccionada.",
              }
            : currentState,
        );
        return;
      }
      const data =
        catalogCreation.kind === "brand"
          ? { name, active: true }
          : { name, brandId: values.brandId, active: true };
      const created = await api<Row>({
        method: "POST",
        url: `/${relation}`,
        data,
      });
      addRelationOption(relation, created);
      if (catalogCreation.kind === "brand") {
        change("brandId", idOf(created), created);
        try {
          const assignedNames = await ensureReferenceModels(idOf(created));
          setCatalogNotice(
            `Marca “${name}” creada con los modelos ${assignedNames.join(", ")}.`,
          );
        } catch (reason) {
          setCatalogCreation((currentState) =>
            currentState
              ? {
                  ...currentState,
                  brandId: idOf(created),
                  saving: false,
                  error: `La marca fue creada, pero faltan modelos. ${
                    reason instanceof Error
                      ? reason.message
                      : "Intenta completar los modelos nuevamente."
                  }`,
                }
              : currentState,
          );
          return;
        }
      } else {
        change("modelId", idOf(created), created);
        setCatalogNotice(`Modelo “${name}” creado y seleccionado.`);
      }
      setCatalogCreation(null);
    } catch (reason) {
      setCatalogCreation((current) =>
        current
          ? {
              ...current,
              saving: false,
              error:
                reason instanceof Error
                  ? reason.message
                  : "No fue posible crear el registro.",
            }
          : current,
      );
    }
  };
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
  const renderField = (field: Field) => {
    const helpId = field.hint ? `vehicle-${field.key}-help` : undefined;
    const control = field.relation ? (
      <RelationSelect
        field={field}
        value={values[field.key] ?? ""}
        values={values}
        describedBy={helpId}
        additionalOptions={additionalOptions[field.relation] ?? []}
        onChange={(value, selected) => change(field.key, value, selected)}
      />
    ) : field.type === "select" ? (
      <Select
        label={field.label}
        value={values[field.key] ?? ""}
        onChange={(e) => change(field.key, e.target.value)}
        required={field.required}
        aria-describedby={helpId}
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
        label={field.label}
        type={field.type ?? "text"}
        value={values[field.key] ?? ""}
        onChange={(e) => change(field.key, e.target.value)}
        required={field.required || (field.key === "password" && !row)}
        min={field.min}
        max={field.max}
        step={field.type === "number" ? (field.integer ? 1 : "any") : undefined}
        placeholder={field.placeholder}
        aria-describedby={helpId}
      />
    );
    const quickCreateKind =
      resource === "vehicles" && field.key === "brandId"
        ? "brand"
        : resource === "vehicles" && field.key === "modelId"
          ? "model"
          : null;
    return (
      <div
        className={`vehicle-form-field${field.key === "description" ? " vehicle-form-field-wide" : ""}`}
        key={field.key}
      >
        {control}
        {quickCreateKind && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="vehicle-catalog-create-button"
            aria-label={
              quickCreateKind === "brand" ? "+ Nueva marca" : "+ Nuevo modelo"
            }
            onClick={() => openCatalogCreation(quickCreateKind)}
          >
            <Icon name="plus" size={14} />
            {quickCreateKind === "brand" ? "Nueva marca" : "Nuevo modelo"}
          </Button>
        )}
        {field.hint && (
          <small className="field-help" id={helpId}>
            {field.hint}
          </small>
        )}
      </div>
    );
  };
  return (
    <>
      <form
        className={`stack${resource === "vehicles" ? " vehicle-admin-form" : ""}`}
        onSubmit={save}
      >
        {resource === "vehicles" ? (
          <>
            <p className="vehicle-form-required-note">
              Los campos marcados con <span aria-hidden="true">*</span> son
              obligatorios.
            </p>
            <div className="vehicle-form-sections">
              {vehicleFieldGroups.map((group) => (
                <section className="vehicle-form-section" key={group.title}>
                  <h3 className="vehicle-form-section-title">{group.title}</h3>
                  <p className="vehicle-form-section-description">
                    {group.description}
                  </p>
                  <div className="vehicle-form-grid">
                    {group.keys.map((key) =>
                      renderField(
                        config.fields.find((field) => field.key === key)!,
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          config.fields.map(renderField)
        )}
        {catalogNotice && (
          <p className="form-success" role="status">
            {catalogNotice}
          </p>
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
      <Modal
        open={catalogCreation !== null}
        onClose={() => {
          if (!catalogCreation?.saving) setCatalogCreation(null);
        }}
        title={
          catalogCreation?.kind === "model" ? "Nuevo modelo" : "Nueva marca"
        }
      >
        {catalogCreation && (
          <div className="stack vehicle-catalog-create-modal">
            <Input
              label={
                catalogCreation.kind === "brand"
                  ? "Nombre de la marca"
                  : "Nombre del modelo"
              }
              placeholder={
                catalogCreation.kind === "brand" ? "Toyota" : "Corolla"
              }
              value={catalogCreation.name}
              onChange={(event) =>
                setCatalogCreation((current) =>
                  current
                    ? { ...current, name: event.target.value, error: "" }
                    : current,
                )
              }
              disabled={catalogCreation.saving}
              readOnly={Boolean(catalogCreation.brandId)}
              autoFocus
            />
            {catalogCreation.kind === "model" && (
              <p className="field-help">
                El modelo se asociará a la marca seleccionada.
              </p>
            )}
            {catalogCreation.error && (
              <p className="form-error" role="alert">
                {catalogCreation.error}
              </p>
            )}
            <div className="inline-actions vehicle-catalog-create-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={catalogCreation.saving}
                onClick={() => setCatalogCreation(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={catalogCreation.saving}
                onClick={() => void createCatalogEntry()}
              >
                {catalogCreation.saving
                  ? "Guardando…"
                  : catalogCreation.brandId
                    ? "Completar modelos"
                    : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
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
                      <td key={column}>{tableCell(resource, row, column)}</td>
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

export function ReservationsAdmin() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [delivery, setDelivery] = useState<DeliveryFormState | null>(null),
    [returning, setReturning] = useState<ReturnFormState | null>(null),
    [message, setMessage] = useState("");
  const url = `/reservations?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`;
  const { data, total = 0, loading, error, load } = useCollection(url),
    columns = [
      "locator",
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
    if (column === "status") {
      if (row.returnedAt) return "COMPLETADA";
      if (row.deliveredAt) return "ENTREGADO";
      if (value === "CONFIRMED")
        return row.digitalCheckinAt ? "PENDIENTE_ENTREGA" : "RESERVADO";
      return (
        (
          {
            PENDING: "RESERVADO",
            CANCELLED: "CANCELADA",
            COMPLETED: "COMPLETADA",
          } as Record<string, string>
        )[String(value)] ?? display(value)
      );
    }
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
  async function openDelivery(row: Row) {
    setMessage("");
    setDelivery({
      row,
      detail: row,
      loading: true,
      submitting: false,
      error: "",
      license: String(row.bookingClientLicense ?? ""),
      mileage: String(row.initialMileage ?? row.vehicleMileage ?? ""),
      operator: "operador-mostrador",
      observations:
        "Vehículo entregado físicamente con contrato y licencia firmada",
    });
    try {
      const detail = await api<Row>({ url: `/reservations/${row.id}` });
      setDelivery((current) =>
        current && String(current.row.id) === String(row.id)
          ? {
              ...current,
              detail,
              loading: false,
              error:
                detail.bookingClientId && detail.bookingClientIdentification
                  ? ""
                  : "La reserva no tiene un cliente Booking con identificación asociado.",
              license:
                current.license || String(detail.bookingClientLicense ?? ""),
              mileage:
                current.mileage ||
                String(detail.initialMileage ?? detail.vehicleMileage ?? ""),
            }
          : current,
      );
    } catch (reason) {
      setDelivery((current) =>
        current && String(current.row.id) === String(row.id)
          ? {
              ...current,
              loading: false,
              error:
                reason instanceof Error
                  ? `No se pudo cargar el detalle: ${reason.message}`
                  : "No se pudo cargar el detalle de la reserva.",
            }
          : current,
      );
    }
  }
  async function submitDelivery() {
    if (!delivery || delivery.loading || delivery.submitting) return;
    const current = delivery.detail;
    const identification = String(current.bookingClientIdentification ?? "");
    const license = delivery.license.trim();
    const parsedMileage = Number(delivery.mileage);
    let validation = "";
    if (String(current.status) !== "CONFIRMED")
      validation = "Solo una reserva confirmada puede entregarse.";
    else if (current.deliveredAt)
      validation = "Esta reserva ya fue entregada y no puede repetirse.";
    else if (!current.bookingClientId || !identification)
      validation =
        "La reserva no tiene un cliente Booking con identificación asociado.";
    else if (!license) validation = "Ingresa la licencia de conducir.";
    else if (!Number.isInteger(parsedMileage) || parsedMileage < 0)
      validation = "El kilometraje debe ser un entero no negativo.";
    else if (
      current.vehicleMileage != null &&
      parsedMileage < Number(current.vehicleMileage)
    )
      validation = "El kilometraje no puede ser menor al actual del vehículo.";
    else if (!delivery.operator.trim())
      validation = "Ingresa el operador responsable.";
    if (validation) {
      setDelivery((value) => (value ? { ...value, error: validation } : value));
      return;
    }
    setDelivery((value) =>
      value ? { ...value, submitting: true, error: "" } : value,
    );
    try {
      if (!current.digitalCheckinAt && !current.deliveredAt) {
        await api({
          method: "POST",
          url: `${autosV3Base}/autos/reservas/${current.id}/checkin`,
          data: {
            documento_identidad: identification,
            numero_licencia: license,
          },
        });
      }
      const result = await api<Row>({
        method: "POST",
        url: `${autosV3Base}/autos/orders/${current.id}/checkin-entrega`,
        data: {
          licencia_conducir: license,
          km_salida: parsedMileage,
          tecnico_entrega: delivery.operator.trim(),
          observaciones: delivery.observations.trim() || undefined,
        },
      });
      const notification = result.booking_notification as Row | undefined;
      setMessage(
        notification?.acknowledged === true
          ? "Entrega confirmada y Booking Central respondió acknowledged=true."
          : "Entrega registrada; la notificación a Booking quedó pendiente de reintento.",
      );
      setDelivery(null);
      await load();
    } catch (reason) {
      setDelivery((value) =>
        value
          ? {
              ...value,
              submitting: false,
              error:
                reason instanceof Error
                  ? reason.message
                  : "No fue posible confirmar la entrega.",
            }
          : value,
      );
    }
  }
  async function openReturn(row: Row) {
    setMessage("");
    setReturning({
      row,
      detail: row,
      loading: true,
      submitting: false,
      error: "",
      mileage: String(
        row.finalMileage ?? row.vehicleMileage ?? row.initialMileage ?? "",
      ),
      fuel: "100",
      observations: "Vehículo recibido y enviado a limpieza",
    });
    try {
      const detail = await api<Row>({ url: `/reservations/${row.id}` });
      setReturning((current) =>
        current && String(current.row.id) === String(row.id)
          ? {
              ...current,
              detail,
              loading: false,
              mileage:
                current.mileage ||
                String(
                  detail.finalMileage ??
                    detail.vehicleMileage ??
                    detail.initialMileage ??
                    "",
                ),
            }
          : current,
      );
    } catch (reason) {
      setReturning((current) =>
        current && String(current.row.id) === String(row.id)
          ? {
              ...current,
              loading: false,
              error:
                reason instanceof Error
                  ? `No se pudo cargar el detalle: ${reason.message}`
                  : "No se pudo cargar el detalle de la reserva.",
            }
          : current,
      );
    }
  }
  async function submitReturn() {
    if (!returning || returning.loading || returning.submitting) return;
    const current = returning.detail;
    const mileage = Number(returning.mileage);
    const fuel = Number(returning.fuel);
    let validation = "";
    if (!current.deliveredAt)
      validation = "El vehículo todavía no ha sido entregado al cliente.";
    else if (current.returnedAt)
      validation = "Esta devolución ya fue registrada.";
    else if (!Number.isInteger(mileage) || mileage < 0)
      validation = "El kilometraje debe ser un entero no negativo.";
    else if (
      current.initialMileage != null &&
      mileage < Number(current.initialMileage)
    )
      validation = "El kilometraje final no puede ser menor al inicial.";
    else if (!Number.isInteger(fuel) || fuel < 0 || fuel > 100)
      validation = "El combustible debe ser un porcentaje entre 0 y 100.";
    if (validation) {
      setReturning((value) =>
        value ? { ...value, error: validation } : value,
      );
      return;
    }
    setReturning((value) =>
      value ? { ...value, submitting: true, error: "" } : value,
    );
    try {
      const result = await api<Row>({
        method: "POST",
        url: `${autosV3Base}/autos/orders/${current.id}/checkin-devolucion`,
        data: {
          km_retorno: mileage,
          nivel_combustible: fuel,
          observaciones: returning.observations.trim() || undefined,
        },
      });
      const cooldown = result.cooldown as Row | undefined;
      const availableAt = cooldown?.fin_cooldown
        ? new Date(String(cooldown.fin_cooldown)).toLocaleString()
        : "al finalizar la limpieza";
      setMessage(
        `Devolución registrada. El vehículo estará disponible ${availableAt}.`,
      );
      setReturning(null);
      await load();
    } catch (reason) {
      setReturning((value) =>
        value
          ? {
              ...value,
              submitting: false,
              error:
                reason instanceof Error
                  ? reason.message
                  : "No fue posible registrar la devolución.",
            }
          : value,
      );
    }
  }
  return (
    <>
      <PageHeader title="Reservas" description="Operación real de reservas." />
      <Card>
        <div className="admin-toolbar">
          <Input
            label="Código, cédula o email"
            placeholder="MDU-…, 1712345678 o cliente@ejemplo.com"
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
                      {String(row.status) === "CONFIRMED" &&
                        !row.deliveredAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => void openDelivery(row)}
                          >
                            Confirmar Entrega de Llaves / Check-in
                          </Button>
                        )}
                      {Boolean(row.deliveredAt) && (
                        <span>Entrega confirmada</span>
                      )}
                      {Boolean(row.deliveredAt) && !row.returnedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => void openReturn(row)}
                        >
                          Devolver vehículo
                        </Button>
                      )}
                      {Boolean(row.returnedAt) && (
                        <span>Vehículo devuelto</span>
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
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
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
      <Modal
        open={!!delivery}
        onClose={() => {
          if (!delivery?.submitting) setDelivery(null);
        }}
        title="Confirmar entrega de llaves / Check-in"
      >
        {delivery && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitDelivery();
            }}
          >
            {delivery.loading ? (
              <p role="status">Cargando datos de la reserva…</p>
            ) : (
              <>
                {!delivery.detail.digitalCheckinAt && (
                  <p role="status">
                    Esta reserva requiere check-in digital previo. Se realizará
                    automáticamente al confirmar, usando la identificación y la
                    licencia asociadas.
                  </p>
                )}
                <Input
                  label="Licencia de conducir"
                  value={delivery.license}
                  onChange={(event) =>
                    setDelivery((value) =>
                      value
                        ? { ...value, license: event.target.value, error: "" }
                        : value,
                    )
                  }
                  required
                />
                <Input
                  label="Kilometraje de salida"
                  type="number"
                  min={0}
                  step={1}
                  value={delivery.mileage}
                  onChange={(event) =>
                    setDelivery((value) =>
                      value
                        ? { ...value, mileage: event.target.value, error: "" }
                        : value,
                    )
                  }
                  required
                />
                <Input
                  label="Operador responsable"
                  value={delivery.operator}
                  onChange={(event) =>
                    setDelivery((value) =>
                      value
                        ? { ...value, operator: event.target.value, error: "" }
                        : value,
                    )
                  }
                  required
                />
                <label className="field">
                  <span>Observaciones</span>
                  <textarea
                    value={delivery.observations}
                    onChange={(event) =>
                      setDelivery((value) =>
                        value
                          ? {
                              ...value,
                              observations: event.target.value,
                              error: "",
                            }
                          : value,
                      )
                    }
                    rows={3}
                  />
                </label>
              </>
            )}
            {delivery.error && (
              <p className="form-error" role="alert">
                {delivery.error}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={delivery.submitting}
                onClick={() => setDelivery(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={delivery.loading || delivery.submitting}
              >
                {delivery.submitting ? "Confirmando…" : "Confirmar entrega"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!returning}
        onClose={() => {
          if (!returning?.submitting) setReturning(null);
        }}
        title="Registrar devolución del vehículo"
      >
        {returning && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitReturn();
            }}
          >
            {returning.loading ? (
              <p role="status">Cargando datos de la reserva…</p>
            ) : (
              <>
                <Input
                  label="Kilometraje de retorno"
                  type="number"
                  min={0}
                  step={1}
                  value={returning.mileage}
                  onChange={(event) =>
                    setReturning((value) =>
                      value
                        ? { ...value, mileage: event.target.value, error: "" }
                        : value,
                    )
                  }
                  required
                />
                <Input
                  label="Nivel de combustible (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={returning.fuel}
                  onChange={(event) =>
                    setReturning((value) =>
                      value
                        ? { ...value, fuel: event.target.value, error: "" }
                        : value,
                    )
                  }
                  required
                />
                <label className="field">
                  <span>Observaciones de devolución</span>
                  <textarea
                    value={returning.observations}
                    onChange={(event) =>
                      setReturning((value) =>
                        value
                          ? {
                              ...value,
                              observations: event.target.value,
                              error: "",
                            }
                          : value,
                      )
                    }
                    rows={3}
                  />
                </label>
              </>
            )}
            {returning.error && (
              <p className="form-error" role="alert">
                {returning.error}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={returning.submitting}
                onClick={() => setReturning(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={returning.loading || returning.submitting}
              >
                {returning.submitting ? "Registrando…" : "Confirmar devolución"}
              </Button>
            </div>
          </form>
        )}
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
