import { Link } from 'react-router-dom';

export function StageNotice({
  kicker,
  title,
  accent,
  description,
  plannedModules = [],
  stageLabel = 'Etapa 1 · Estructura base preparada',
}) {
  return (
    <section className="area-panel">
      <span className="area-badge">{stageLabel}</span>
      <p className="mini-label mt-4">{kicker}</p>
      <h1>
        {title} <em>{accent}</em>
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-[#685a4d]">
        {description}
      </p>

      {plannedModules.length > 0 && (
        <ul className="area-list">
          {plannedModules.map((moduleName) => (
            <li key={moduleName}>{moduleName}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-4">
        <Link className="button button-fire" to="/">
          VOLVER AL SITIO PÚBLICO <span>↗</span>
        </Link>
      </div>
    </section>
  );
}
