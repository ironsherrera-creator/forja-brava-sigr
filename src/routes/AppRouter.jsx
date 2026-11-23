import { Route, Routes } from 'react-router-dom';
import { AreaPlaceholderLayout } from '../layouts/AreaPlaceholderLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { AdminPlaceholderPage } from '../pages/AdminPlaceholderPage';
import { ClientPlaceholderPage } from '../pages/ClientPlaceholderPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { WaiterPlaceholderPage } from '../pages/WaiterPlaceholderPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      <Route element={<AreaPlaceholderLayout subtitle="SIGR · CLIENTE" />}>
        <Route path="/cliente/*" element={<ClientPlaceholderPage />} />
      </Route>

      <Route element={<AreaPlaceholderLayout subtitle="SIGR · SERVICIO" />}>
        <Route path="/mesero/*" element={<WaiterPlaceholderPage />} />
      </Route>

      <Route element={<AreaPlaceholderLayout subtitle="SIGR · ADMIN" />}>
        <Route path="/admin/*" element={<AdminPlaceholderPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
