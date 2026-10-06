export type ReservationStatus =
  "Confirmada" | "Pendiente" | "Completada" | "Cancelada";
export const reservations: {
  id: string;
  vehicleId: string;
  customer: string;
  start: string;
  end: string;
  pickup: string;
  status: ReservationStatus;
  total: number;
}[] = [
  {
    id: "MDU-2048",
    vehicleId: "toyota-rav4",
    customer: "Andrea Torres",
    start: "2026-10-12",
    end: "2026-10-15",
    pickup: "Aeropuerto de Quito",
    status: "Confirmada",
    total: 204,
  },
  {
    id: "MDU-2047",
    vehicleId: "mazda-3",
    customer: "Mateo Salazar",
    start: "2026-10-20",
    end: "2026-10-22",
    pickup: "Centro de Quito",
    status: "Pendiente",
    total: 90,
  },
  {
    id: "MDU-2030",
    vehicleId: "kia-sportage",
    customer: "Andrea Torres",
    start: "2026-08-05",
    end: "2026-08-08",
    pickup: "Aeropuerto de Guayaquil",
    status: "Completada",
    total: 177,
  },
  {
    id: "MDU-2021",
    vehicleId: "ford-ranger",
    customer: "Daniel Vega",
    start: "2026-07-10",
    end: "2026-07-12",
    pickup: "Centro de Cuenca",
    status: "Cancelada",
    total: 170,
  },
];
export const users = [
  {
    id: "u1",
    name: "Andrea Torres",
    email: "andrea@example.test",
    role: "Cliente",
    active: true,
    date: "12 sep 2026",
  },
  {
    id: "u2",
    name: "Mateo Salazar",
    email: "mateo@example.test",
    role: "Cliente",
    active: true,
    date: "10 sep 2026",
  },
  {
    id: "u3",
    name: "Daniel Vega",
    email: "daniel@example.test",
    role: "Cliente",
    active: false,
    date: "08 sep 2026",
  },
  {
    id: "u4",
    name: "Valentina Ríos",
    email: "valentina@example.test",
    role: "Administrador",
    active: true,
    date: "01 sep 2026",
  },
];
export const dashboardStats = [
  {
    label: "Vehículos activos",
    value: "16",
    note: "14 disponibles para salir",
    icon: "car",
  },
  {
    label: "Reservas activas",
    value: "24",
    note: "+12% respecto al mes anterior",
    icon: "calendar",
  },
  {
    label: "Usuarios",
    value: "128",
    note: "18 nuevos este mes",
    icon: "users",
  },
  {
    label: "Ingresos estimados",
    value: "$4.280",
    note: "Proyección de septiembre",
    icon: "chart",
  },
];
