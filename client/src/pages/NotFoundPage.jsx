import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-6xl font-bold text-brand-600 mb-2">404</h1>
      <p className="text-slate-600 mb-6">Page not found</p>
      <Link to="/" className="btn-primary">
        Go home
      </Link>
    </div>
  );
}
