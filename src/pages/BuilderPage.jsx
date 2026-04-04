import { useLocation } from 'react-router-dom';
import NetworkBuilder from '../components/NetworkBuilder.jsx';

export default function BuilderPage() {
  const location = useLocation();
  const addProduct = location.state?.addProduct || null;

  return (
    <div className="builder-page">
      <NetworkBuilder initialProduct={addProduct} navigationKey={location.key} />
    </div>
  );
}
