import { Routes, Route, Link } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { AccountLayout } from "../layouts/AccountLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { Home } from "../pages/Home";
import { Vehicles } from "../pages/Vehicles";
import { VehicleDetail } from "../pages/VehicleDetail";
import { Compare } from "../pages/Compare";
import { Favorites } from "../pages/Favorites";
import { Auth } from "../pages/Auth";
import { Reservations } from "../pages/Reservations";
import {
  AdminDashboard,
  AdminVehicles,
  AdminReservations,
  AdminUsers,
  AdminSettings,
} from "../pages/Admin";
import { EmptyState } from "../components/ui";
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="vehiculos" element={<Vehicles />} />
        <Route path="vehiculos/:id" element={<VehicleDetail />} />
        <Route path="comparar" element={<Compare />} />
        <Route path="favoritos" element={<Favorites />} />
        <Route path="login" element={<Auth key="login" />} />
        <Route path="registro" element={<Auth register key="register" />} />
        <Route element={<AccountLayout />}>
          <Route path="mis-reservas" element={<Reservations />} />
        </Route>
        <Route
          path="*"
          element={
            <EmptyState
              title="Este camino no existe."
              description="Volvamos a encontrar tu próximo destino."
            >
              <Link className="btn btn-primary" to="/">
                Volver al inicio
              </Link>
            </EmptyState>
          }
        />
      </Route>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="vehiculos" element={<AdminVehicles />} />
        <Route path="reservas" element={<AdminReservations />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="configuracion" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
