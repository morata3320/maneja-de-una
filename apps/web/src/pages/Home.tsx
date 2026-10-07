import { Link } from "react-router-dom";
import { useVehiclesController } from "../controllers/useVehiclesController";
import { SearchBar } from "../components/search/SearchBar";
import { VehicleCard } from "../components/vehicle/VehicleCard";
import { SectionHeader } from "../components/ui";
import { Icon } from "../components/ui/Icon";
export function Home() {
  const { vehicles } = useVehiclesController("?limit=4");
  const categories = [...new Set(vehicles.map((vehicle) => vehicle.category))];
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span />
              TU VIAJE EMPIEZA AQUÍ
            </span>
            <h1>
              Más caminos.
              <br />
              Menos vueltas.
            </h1>
            <p>
              Encuentra el auto para tu próximo plan.
              <br />
              Elige, compara y maneja de una.
            </p>
            <div className="hero-trust">
              <Icon name="shield" size={18} />
              <span>Precios claros. Libertad para elegir.</span>
            </div>
          </div>
          <div className="hero-scene">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="scene-word">GO.</span>
            <img
              src="/images/suv.svg"
              alt="Ilustración de un SUV, tu próximo compañero de viaje"
              className="hero-car"
            />
            <div className="scene-tag">
              <span className="tag-dot" />
              <div>
                Tu próximo destino<strong>Lo eliges tú.</strong>
              </div>
              <Icon name="arrow" />
            </div>
            <span className="scene-caption">Una nueva forma de moverte</span>
          </div>
        </div>
        <div className="container hero-search">
          <SearchBar />
        </div>
      </section>
      <div className="container benefits">
        <div>
          <Icon name="shield" />
          <span>
            <strong>Sin sorpresas</strong>Precios claros desde el inicio
          </span>
        </div>
        <div>
          <Icon name="clock" />
          <span>
            <strong>Así de simple</strong>Encuentra tu auto en minutos
          </span>
        </div>
        <div>
          <Icon name="car" />
          <span>
            <strong>Para cada plan</strong>Un auto que va contigo
          </span>
        </div>
        <div>
          <Icon name="support" />
          <span>
            <strong>Cerca de ti</strong>Ayuda durante tu recorrido
          </span>
        </div>
      </div>
      <section className="container section">
        <SectionHeader
          eyebrow="ENCUENTRA TU PRÓXIMO COMPAÑERO"
          title="Autos para arrancar de una"
          description="De la rutina a la escapada. Hay un auto para eso."
          action={
            <Link className="text-link" to="/vehiculos">
              Ver todos los autos <Icon name="arrow" />
            </Link>
          }
        />
        <div className="vehicle-grid home-grid">
          {vehicles.slice(0, 4).map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      </section>
      <section className="category-section">
        <div className="container section">
          <SectionHeader
            eyebrow="DIFERENTES PLANES, MISMA LIBERTAD"
            title="¿Qué te mueve hoy?"
          />
          <div className="category-grid">
            {categories.map((category, i) => (
              <Link
                key={category}
                className={`category-card category-${i}`}
                to={`/vehiculos?category=${encodeURIComponent(category)}`}
              >
                <div>
                  <h3>{category}</h3>
                  <p>Opciones reales disponibles</p>
                </div>
                <img src={vehicles.find((vehicle) => vehicle.category === category)?.image} alt={`Categoría ${category}`} loading="lazy" />
                <span className="round-arrow">
                  <Icon name="arrow" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="como-funciona" className="container section how-section">
        <div>
          <span className="eyebrow">MENOS TRÁMITES. MÁS KILÓMETROS.</span>
          <h2>
            Busca. Elige.
            <br />
            <span className="text-primary">Maneja.</span>
          </h2>
          <p>
            Tu próximo viaje no tiene
            <br />
            por qué ser complicado.
          </p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Busca tu destino",
              "Dinos dónde y cuándo. Encuentra opciones para tu recorrido.",
              "search",
            ],
            [
              "02",
              "Elige a tu manera",
              "Compara autos, características y precios. Quédate con el tuyo.",
              "compare",
            ],
            [
              "03",
              "Haz tuyo el camino",
              "Recoge tu auto y empieza a disfrutar de lo que viene.",
              "car",
            ],
          ].map(([n, title, text, icon]) => (
            <div className="step" key={n}>
              <span className="step-number">{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <Icon name={icon} size={26} />
            </div>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="final-cta">
          <div>
            <span className="eyebrow">LO MEJOR ESTÁ POR VENIR</span>
            <h2>
              Tu próximo plan
              <br />
              necesita un buen auto.
            </h2>
            <Link to="/vehiculos" className="btn btn-accent btn-lg">
              Vamos a encontrarlo <Icon name="arrow" />
            </Link>
          </div>
          <div className="cta-road" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="cta-word">de una.</span>
        </div>
      </section>
    </>
  );
}
