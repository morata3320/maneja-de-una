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
import { MyReservations } from "../views/MyReservations";
import { AdminApiCollection, AdminDashboardApi } from "../views/AdminApi";
import { Checkout } from "../views/Checkout";
import { EmptyState } from "../components/ui";
import { Profile } from "../views/Profile";
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
        <Route path="checkout/:vehicleId" element={<Checkout />} />
        <Route element={<AccountLayout />}>
          <Route path="mis-reservas" element={<MyReservations />} />
          <Route path="perfil" element={<Profile />} />
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
        <Route index element={<AdminDashboardApi />} />
        <Route
          path="vehiculos"
          element={<AdminApiCollection resource="vehicles" title="Vehículos" />}
        />
        <Route
          path="reservas"
          element={
            <AdminApiCollection
              resource="reservations"
              title="Reservas"
              action="cancel"
            />
          }
        />
        <Route
          path="usuarios"
          element={<AdminApiCollection resource="users" title="Clientes" />}
        />
        <Route
          path="clientes"
          element={<AdminApiCollection resource="users" title="Clientes" />}
        />
        <Route
          path="marcas"
          element={
            <AdminApiCollection resource="brands" title="Marcas" create />
          }
        />
        <Route
          path="modelos"
          element={
            <AdminApiCollection resource="vehicle-models" title="Modelos" />
          }
        />
        <Route
          path="categorias"
          element={
            <AdminApiCollection
              resource="categories"
              title="Categorías"
              create
            />
          }
        />
        <Route
          path="ubicaciones"
          element={
            <AdminApiCollection resource="locations" title="Ubicaciones" />
          }
        />
        <Route
          path="proveedores"
          element={
            <AdminApiCollection
              resource="suppliers"
              title="Proveedores"
              create
            />
          }
        />
        <Route
          path="agencias"
          element={<AdminApiCollection resource="depots" title="Agencias" />}
        />
        <Route
          path="calificaciones"
          element={
            <AdminApiCollection
              resource="depot-scores"
              title="Calificaciones"
            />
          }
        />
        <Route
          path="pagos"
          element={<AdminApiCollection resource="payments" title="Pagos" />}
        />
      </Route>
    </Routes>
  );
}
