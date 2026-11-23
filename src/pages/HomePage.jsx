import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LOCAL_IMAGES } from '../assets/images';
import {
  CATEGORIES_PREVIEW,
  PRODUCTS_PREVIEW,
  RESTAURANT_INFO,
} from '../features/public/catalogPreview';
import { useRevealObserver } from '../hooks/useRevealObserver';
import { formatMoney } from '../utils/formatMoney';

export function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('todos');
  useRevealObserver();

  const visibleProducts = PRODUCTS_PREVIEW.filter(
    (item) => selectedCategory === 'todos' || item.category === selectedCategory,
  );
  const featuredProduct = PRODUCTS_PREVIEW[0];
  const activeCategoriesCount = CATEGORIES_PREVIEW.length - 1;

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
            <a className="button button-fire bg-fire hover:bg-fire/90" href="#menu">
              EXPLORAR MENÚ <span>↗</span>
            </a>
            <a className="text-link" href="#esencia">
              CONOCE NUESTRA ESENCIA <span>↓</span>
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

      <section className="essence section-light" id="esencia">
        <div className="section-kicker reveal">
          <span>01 / NUESTRA ESENCIA</span>
          <span>BOGOTÁ, COLOMBIA</span>
        </div>
        <div className="essence-grid">
          <div className="essence-title reveal">
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

          <div className="essence-copy reveal">
            <p className="lead">
              Creemos que un buen antojo merece hacerse sin afán.
            </p>
            <p>
              Por eso encendemos el fuego, buscamos ingredientes que valen la
              pena y le ponemos acento colombiano a cada receta. Sin poses. Sin
              atajos. Solo comida hecha con ganas.
            </p>
            <a className="under-link" href="#experiencia">
              ASÍ LO HACEMOS <span>↗</span>
            </a>
            <div className="essence-note">
              <span>01</span>
              <p>
                Fuego vivo.
                <br />
                <em>Manos a la obra.</em>
              </p>
            </div>
          </div>

          <figure className="essence-photo reveal">
            <img
              src={LOCAL_IMAGES.products.brava}
              alt="Hamburguesa artesanal a la parrilla con pan tostado y queso fundido"
              loading="lazy"
            />
            <figcaption>
              <span>01 — EL FUEGO HACE LO SUYO</span>
              <span>↗</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="menu-section" id="menu">
        <div className="menu-top section-kicker reveal">
          <span>02 / LA CARTA</span>
          <span>HECHA PARA EL ANTOJO</span>
        </div>

        <div className="menu-heading reveal">
          <div>
            <span className="mini-label">ELIGE TU BATALLA</span>
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

        <div className="menu-toolbar">
          <div
            className="filters"
            role="group"
            aria-label="Filtrar menú por categoría"
          >
            {CATEGORIES_PREVIEW.map((category) => {
              const isActive = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`filter-btn ${isActive ? 'active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.label}
                  {category.id === 'todos' && (
                    <span>{PRODUCTS_PREVIEW.length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="menu-count">
            {String(visibleProducts.length).padStart(2, '0')} ANTOJOS ·{' '}
            {String(activeCategoriesCount).padStart(2, '0')} CATEGORÍAS
          </span>
        </div>

        <div className="product-grid" aria-live="polite">
          {visibleProducts.map((item, index) => (
            <article
              key={item.id}
              className="product-card"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="product-image-wrap">
                <img
                  src={item.image}
                  alt={`${item.name}, ${item.desc}`}
                  loading="lazy"
                />
                {item.tag && <span className="product-tag">{item.tag}</span>}
              </div>
              <div className="product-info">
                <div className="product-name-row">
                  <h3 className="product-name">{item.name}</h3>
                  <span className="product-price">
                    {formatMoney(item.price)}
                  </span>
                </div>
                <p className="product-desc">{item.desc}</p>
                <div className="product-meta">
                  <span>CATÁLOGO BASE</span>
                  <span>ETAPA 1</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="menu-foot">
          <span>✳</span>
          <p>
            ¿No sabes por dónde empezar?
            <br />
            <em>La Forjada siempre cae bien.</em>
          </p>
          <a href="#destacado" className="under-link">
            DESCUBRE LA FAVORITA ↗
          </a>
        </div>
      </section>

      <section className="feature" id="destacado">
        <div
          className="feature-image"
          role="img"
          aria-label="Hamburguesa especial con ingredientes frescos"
          style={{ backgroundImage: `url(${featuredProduct.image})` }}
        />
        <div className="feature-overlay" />
        <div className="feature-content reveal">
          <span className="mini-label">LA FAVORITA DE LA CASA · 01</span>
          <h2>
            EL PROTAGONISTA
            <br />
            <em>DE LA CASA.</em>
          </h2>
          <p>
            La Forjada junta todo lo que nos mueve: carne a la parrilla, queso
            fundido, tocineta crocante y nuestra salsa de la casa. Un clásico
            con fuego propio.
          </p>
          <div className="feature-ingredients">
            <span>CARNE A LA PARRILLA</span>
            <i>✳</i>
            <span>QUESO FUNDIDO</span>
            <i>✳</i>
            <span>SALSA BRAVA</span>
          </div>
          <div className="feature-bottom">
            <span className="feature-price">
              {formatMoney(featuredProduct.price)} <small>COP</small>
            </span>
            <Link className="button button-fire" to="/cliente">
              IR AL ÁREA CLIENTE <span>↗</span>
            </Link>
          </div>
        </div>
        <div className="feature-number">
          01<span>/</span>01
        </div>
      </section>

      <section className="experience section-light" id="experiencia">
        <div className="section-kicker reveal">
          <span>03 / LO QUE NOS MUEVE</span>
          <span>DE LA COCINA A LA MESA</span>
        </div>
        <div className="experience-heading reveal">
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
          <figure className="experience-card experience-card-tall reveal">
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
          <figure className="experience-card reveal">
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
          <figure className="experience-card reveal">
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

      <section className="contact-section" id="contacto">
        <div className="contact-text reveal">
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
            Base React + Vite operativa para la evolución de FORJA BRAVA — SIGR.
            Los módulos de carrito, checkout, reservas, mesero y administración
            se integrarán progresivamente en las siguientes etapas.
          </p>
          <a className="button button-fire mt-4" href="#menu">
            EXPLORAR CARTA <span>↗</span>
          </a>
        </div>

        <div className="contact-info reveal">
          <div className="contact-row">
            <span>VISÍTANOS</span>
            <p>{RESTAURANT_INFO.location}</p>
          </div>
          <div className="contact-row">
            <span>HORARIO</span>
            <p>{RESTAURANT_INFO.hours}</p>
          </div>
          <div className="contact-row">
            <span>ESCRÍBENOS</span>
            <p>{RESTAURANT_INFO.phone}</p>
          </div>
        </div>
      </section>
    </>
  );
}
