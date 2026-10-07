import { AppRoutes } from "./routes/AppRoutes";
import { LocalExperience } from "./components/LocalExperience";
import "./styles/variables.css";
import "./styles/global.css";
import { AuthProvider } from "./controllers/AuthContext";
import { ThemeProvider } from "./controllers/ThemeContext";
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocalExperience>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <AppRoutes />
        </LocalExperience>
      </AuthProvider>
    </ThemeProvider>
  );
}
