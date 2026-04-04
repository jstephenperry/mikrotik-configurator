import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useProducts from '../hooks/useProducts.js';
import FilterBar from '../components/FilterBar.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductDetail from '../components/ProductDetail.jsx';

export default function CatalogPage() {
  const { products, loading, error } = useProducts();
  const navigate = useNavigate();

  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [portFilters, setPortFilters] = useState({});
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const maxPrice = useMemo(() => {
    if (products.length === 0) return 2000;
    return Math.ceil(Math.max(...products.map((p) => p.price_usd || 0)) / 100) * 100;
  }, [products]);

  // Derive effective price range - auto-extend to maxPrice when at default
  const effectivePriceRange = useMemo(() => {
    if (priceRange[1] === 2000 && maxPrice > 2000) {
      return [priceRange[0], maxPrice];
    }
    return priceRange;
  }, [priceRange, maxPrice]);

  const filtered = useMemo(() => {
    let result = products;

    // Category filter
    if (category !== 'all') {
      result = result.filter((p) => p.category === category);
    }

    // Search filter
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.model.toLowerCase().includes(term) ||
          (p.short_descriptor && p.short_descriptor.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    // Port type filters
    if (portFilters.sfp_plus) {
      result = result.filter((p) => (p.ports?.sfp_plus_count || 0) > 0);
    }
    if (portFilters.sfp28) {
      result = result.filter((p) => (p.ports?.sfp28_count || 0) > 0);
    }
    if (portFilters.qsfp) {
      result = result.filter(
        (p) => (p.ports?.qsfp_plus_count || 0) > 0 || (p.ports?.qsfp28_count || 0) > 0
      );
    }
    if (portFilters.poe) {
      result = result.filter((p) => p.ports?.poe_out || p.ports?.poe_in);
    }
    if (portFilters['10g']) {
      result = result.filter(
        (p) =>
          (p.ports?.sfp_plus_count || 0) > 0 ||
          (p.ports?.sfp28_count || 0) > 0 ||
          (p.ports?.qsfp_plus_count || 0) > 0 ||
          (p.ports?.qsfp28_count || 0) > 0 ||
          (p.ports?.ethernet_speed || []).some((s) =>
            ['10G', '25G', '40G', '100G'].includes(s)
          )
      );
    }
    if (portFilters.wifi) {
      result = result.filter((p) => p.wireless != null);
    }
    if (portFilters.lte) {
      result = result.filter((p) => p.lte != null);
    }

    // Price range
    result = result.filter((p) => {
      const price = p.price_usd || 0;
      return price >= effectivePriceRange[0] && price <= effectivePriceRange[1];
    });

    return result;
  }, [products, category, search, portFilters, effectivePriceRange]);

  function handlePortFilterChange(key, checked) {
    setPortFilters((prev) => ({ ...prev, [key]: checked }));
  }

  function handleAddToNetwork(product) {
    setSelectedProduct(null);
    navigate('/builder', { state: { addProduct: product } });
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-error">
        <p>Failed to load products: {error}</p>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <FilterBar
        category={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
        portFilters={portFilters}
        onPortFilterChange={handlePortFilterChange}
        priceRange={effectivePriceRange}
        onPriceRangeChange={setPriceRange}
        maxPrice={maxPrice}
      />

      <div className="catalog-results-count">
        {filtered.length} device{filtered.length !== 1 ? 's' : ''} found
      </div>

      <div className="product-grid">
        {filtered.map((product) => (
          <ProductCard
            key={product._catalogId || product.model}
            product={product}
            onClick={setSelectedProduct}
          />
        ))}
        {filtered.length === 0 && (
          <div className="no-results">
            <p>No products match your filters. Try adjusting the criteria.</p>
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToNetwork={handleAddToNetwork}
        />
      )}
    </div>
  );
}
