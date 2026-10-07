import { AppRoutes } from "./routes/AppRoutes";
import { LocalExperience } from "./components/LocalExperience";
import "./styles/variables.css";
import "./styles/global.css";
import { AuthProvider } from "./controllers/AuthContext";
export default function App() {
  return (
    <AuthProvider>
      <LocalExperience>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <AppRoutes />
      </LocalExperience>
    </AuthProvider>
  );
}
