import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Clock, MapPin, Phone, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LOCAL_IMAGES } from '../assets/images';
import { ProductCard } from '../components/public/ProductCard';
import { ProductImage } from '../components/public/ProductImage';
import { ErrorState, SkeletonCard } from '../components/ui';
import { useRevealObserver } from '../hooks/useRevealObserver';
import {
  fetchLandingData,
  formatBusinessHoursList,
} from '../services/catalogService';
import { formatMoney } from '../utils/formatMoney';

export function HomePage() {
  const [data, setData] = useState({
    settings: null,
    categories: [],
    products: [],
    featuredProduct: null,
    highlightedProducts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useRevealObserver();

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetchLandingData().then((result) => {
      if (!active) return;
      if (result.error && result.products.length === 0 && result.categories.length === 0) {
        setError(result.error);
      } else {
        setError(null);
      }
      setData({
        settings: result.settings,
        categories: result.categories,
        products: result.products,
        featuredProduct: result.featuredProduct,
        highlightedProducts: result.highlightedProducts,
      });
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const { settings, categories, featuredProduct, highlightedProducts } = data;
  const businessHours = formatBusinessHoursList(settings?.business_hours);

  return (
    <>
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <div
          className="hero-image"
          role="img"
          aria-label="Hamburguesa artesanal dorada sobre una tabla de madera, junto a brasas encendidas"
          style={{ backgroundImage: `url(${LOCAL_IMAGES.hero})` }}
        />
        <div className="hero-shade" />
        <div className="hero-grain" />

        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">
            <span className="eyebrow-line" /> COMIDA RÁPIDA · HECHA CON CARÁCTER
          </p>
          <h1 id="hero-title">
            El sabor que
            <br />
            se hace <em>a fuego.</em>
          </h1>
          <p className="hero-copy">
            El antojo colombiano, llevado al fuego. Ingredientes honestos, fuego
            vivo y sabor que deja huella.
          </p>
          <div className="hero-actions flex flex-col sm:flex-row">
            <Link className="button button-fire bg-fire hover:bg-fire-hover" to="/menu">
              <span>EXPLORAR MENÚ</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a className="text-link inline-flex items-center gap-2" href="#esencia">
              <span>CONOCE NUESTRA ESENCIA</span>
              <ArrowDown className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="hero-stamp">
          <span>HECHO</span>
          <b>A FUEGO</b>
          <span>DESDE EL PRIMER BOCADO</span>
          <i>✳</i>
        </div>
        <div className="hero-index">
          <span>01</span>
          <span className="index-line" />
          <span>04</span>
        </div>
        <div className="hero-caption">FUEGO LENTO · SABOR BRAVO</div>
      </section>

      <div className="ticker" aria-label="Preparado al momento, sabor sin atajos">
        <div className="ticker-track">
          <span>PREPARADO AL MOMENTO</span>
          <i>✳</i>
          <span>SABOR SIN ATAJOS</span>
          <i>✳</i>
          <span>HECHO A FUEGO</span>
          <i>✳</i>
          <span>PREPARADO AL MOMENTO</span>
          <i>✳</i>
          <span>SABOR SIN ATAJOS</span>
          <i>✳</i>
          <span>HECHO A FUEGO</span>
          <i>✳</i>
        </div>
      </div>

      {/* 01 / Nuestra Esencia */}
      <section className="essence section-light" id="esencia">
        <div className="section-kicker">
          <span>01 / NUESTRA ESENCIA</span>
          <span>COCINA COLOMBIANA AL FUEGO</span>
        </div>
        <div className="essence-grid">
          <div className="essence-title">
            <span className="mini-label">MÁS FUEGO. MÁS SABOR.</span>
            <h2>
              NO ES SOLO
              <br />
              COMIDA RÁPIDA.
              <br />
              <em>ES CARÁCTER.</em>
            </h2>
            <div className="hand-drawn">✳</div>
          </div>

          <div className="essence-copy">
            <p className="lead">
              Creemos que un buen antojo merece hacerse sin afán.
            </p>
            <p>
              Por eso encendemos el fuego, buscamos ingredientes que valen la
              pena y le ponemos acento colombiano a cada receta. Sin poses. Sin
              atajos. Solo comida hecha con ganas.
            </p>
            <Link className="under-link inline-flex items-center gap-2" to="/menu">
              <span>VER LA CARTA COMPLETA</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
            </Link>
            <div className="essence-note">
              <span>01</span>
              <p>
                Fuego vivo.
                <br />
                <em>Manos a la obra.</em>
              </p>
            </div>
          </div>

          <figure className="essence-photo">
            <img
              src={LOCAL_IMAGES.products.brava}
              alt="Hamburguesa artesanal a la parrilla con pan tostado y queso fundido"
              loading="lazy"
            />
            <figcaption>
              <span>01 — EL FUEGO HACE LO SUYO</span>
              <ArrowUpRight className="h-3 w-3 text-fire" aria-hidden="true" />
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 02 / Categorías y Productos Destacados desde Supabase */}
      <section className="menu-section" id="menu">
        <div className="menu-top section-kicker">
          <span>02 / LA CARTA EN VIVO</span>
          <span>ACTUALIZADA DESDE COCINA</span>
        </div>

        <div className="menu-heading">
          <div>
            <span className="mini-label">EXPLORA POR CATEGORÍA</span>
            <h2>
              DEL FUEGO
              <br />
              <em>A TU MESA.</em>
            </h2>
          </div>
          <p>
            Recetas con acento colombiano.
            <br />
            Todo preparado al momento.
          </p>
        </div>

        {error ? (
          <ErrorState
            title="No pudimos conectar con la carta"
            description={error.message}
            onRetry={handleRetry}
          />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* Categorías activas desde Supabase */}
            {categories.length > 0 && (
              <div className="mb-12">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/menu/${cat.slug}`}
                      className="group flex flex-col justify-between p-5 bg-surface-dark border border-sand/15 rounded-[var(--radius-sm)] hover:border-fire transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                            Categoría
                          </span>
                          <UtensilsCrossed
                            className="h-4 w-4 text-sand/60 group-hover:text-fire transition-colors"
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className="m-0 mt-2 text-2xl font-medium text-cream sigr-heading-display">
                          {cat.name}
                        </h3>
                        {cat.description && (
                          <p className="m-0 mt-2 text-xs leading-relaxed text-paper/70">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <span className="mt-4 pt-3 border-t border-sand/15 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-sand group-hover:text-cream transition-colors">
                        <span>Explorar {cat.name}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Productos destacados desde Supabase */}
            {highlightedProducts.length > 0 && (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                  <div>
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                      SELECCIÓN DE LA CASA
                    </p>
                    <h3 className="m-0 mt-1 text-3xl font-medium text-cream sigr-heading-display">
                      Productos <em className="text-fire">destacados.</em>
                    </h3>
                  </div>
                  <Link
                    to="/menu"
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cream border-b border-fire pb-1 hover:text-fire-hover transition-colors"
                  >
                    <span>Ver todo el menú</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                  </Link>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {highlightedProducts.map((item) => (
                    <ProductCard key={item.id} product={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Producto protagonista configurado en restaurant_settings.featured_product_id */}
      {featuredProduct && (
        <section className="feature" id="destacado">
          <div className="feature-image">
            <ProductImage
              imageUrl={featuredProduct.image_url}
              slug={featuredProduct.slug}
              alt={featuredProduct.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="feature-overlay" />
          <div className="feature-content">
            <span className="mini-label">LA FAVORITA DE LA CASA · 01</span>
            <h2>
              {featuredProduct.name}
              <br />
              <em>al fuego.</em>
            </h2>
            <p>{featuredProduct.description}</p>
            <div className="feature-bottom mt-7">
              <span className="feature-price">
                {formatMoney(featuredProduct.price)} <small>COP</small>
              </span>
              <Link
                className="button button-fire"
                to={`/producto/${featuredProduct.slug}`}
              >
                <span>VER DETALLE</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="feature-number">
            01<span>/</span>01
          </div>
        </section>
      )}

      {/* 03 / Propuesta gastronómica */}
      <section className="experience section-light" id="experiencia">
        <div className="section-kicker">
          <span>03 / LO QUE NOS MUEVE</span>
          <span>DE LA COCINA A LA MESA</span>
        </div>
        <div className="experience-heading">
          <h2>
            EL SABOR ESTÁ
            <br />
            EN <em>LOS DETALLES.</em>
          </h2>
          <p>
            No hay truco: buen producto, manos expertas
            <br />y el tiempo justo sobre las brasas.
          </p>
        </div>
        <div className="experience-grid">
          <figure className="experience-card experience-card-tall">
            <img
              src={LOCAL_IMAGES.products['doble-carbon']}
              alt="Doble Carbón cocinada a la parrilla"
              loading="lazy"
            />
            <figcaption>
              <span>01</span>
              <b>FUEGO VIVO</b>
              <small>El sabor empieza aquí.</small>
            </figcaption>
          </figure>
          <figure className="experience-card">
            <img
              src={LOCAL_IMAGES.products.mazorcada}
              alt="Mazorcada con ingredientes frescos colombianos"
              loading="lazy"
            />
            <figcaption>
              <span>02</span>
              <b>INGREDIENTES REALES</b>
              <small>Frescos. Sin vueltas.</small>
            </figcaption>
          </figure>
          <figure className="experience-card">
            <img
              src={LOCAL_IMAGES.products['salchipapa-mixta']}
              alt="Salchipapa mixta para compartir en mesa"
              loading="lazy"
            />
            <figcaption>
              <span>03</span>
              <b>BUENAS COMPAÑÍAS</b>
              <small>El resto lo pones tú.</small>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 04 / Contacto y horarios desde restaurant_settings */}
      <section className="contact-section" id="contacto">
        <div className="contact-text">
          <div className="section-kicker">
            <span>04 / ENCUÉNTRANOS</span>
            <span>SIEMPRE HAY UN ANTOJO</span>
          </div>
          <h2>
            EL FUEGO
            <br />
            ESTÁ <em>ENCENDIDO.</em>
          </h2>
          <p>
            Explora la carta actualizada, personaliza tus platos con complementos
            y arma tu carrito para disfrutar FORJA BRAVA donde prefieras.
          </p>
          <Link className="button button-fire mt-4" to="/menu">
            <span>EXPLORAR CARTA</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="contact-info">
          {settings?.location && (
            <div className="contact-row">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                VISÍTANOS
              </span>
              <p>{settings.location}</p>
            </div>
          )}

          {businessHours.length > 0 && (
            <div className="contact-row">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                HORARIO
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-cream">
                {businessHours.map((entry) => (
                  <p key={entry.day} className="m-0">
                    <strong className="text-sand">{entry.day}:</strong>{' '}
                    {entry.schedule}
                  </p>
                ))}
              </div>
            </div>
          )}

          {settings?.phone && (
            <div className="contact-row">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                TELÉFONO
              </span>
              <p>{settings.phone}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
