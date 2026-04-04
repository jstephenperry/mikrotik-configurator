import { Search, Filter, ChevronDown } from 'lucide-react';

export default function FilterBar({
  category,
  onCategoryChange,
  search,
  onSearchChange,
  portFilters,
  onPortFilterChange,
  priceRange,
  onPriceRangeChange,
  maxPrice,
}) {
  const categories = [
    { value: 'all', label: 'All Devices' },
    { value: 'ethernet-routers', label: 'Routers' },
    { value: 'switches', label: 'Switches' },
    { value: 'wireless-for-home-and-office', label: 'Wireless' },
    { value: 'wireless-systems', label: 'Wireless Systems' },
    { value: 'lte-5g-products', label: 'LTE/5G' },
    { value: 'iot-products', label: 'IoT' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'sfp-qsfp', label: 'SFP/QSFP' },
    { value: 'routerboard', label: 'RouterBOARD' },
  ];

  const portOptions = [
    { key: 'sfp_plus', label: 'SFP+' },
    { key: 'sfp28', label: 'SFP28' },
    { key: 'qsfp', label: 'QSFP+' },
    { key: 'poe', label: 'PoE' },
    { key: '10g', label: '10G+' },
    { key: 'wifi', label: 'WiFi' },
    { key: 'lte', label: 'LTE/5G' },
  ];

  return (
    <div className="filter-bar">
      <div className="filter-section filter-categories">
        {categories.map((cat) => (
          <button
            key={cat.value}
            className={`filter-btn ${category === cat.value ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="filter-section filter-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or model..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-section filter-ports">
        <Filter size={14} />
        <span className="filter-label">Ports:</span>
        {portOptions.map((opt) => (
          <label key={opt.key} className="port-filter-checkbox">
            <input
              type="checkbox"
              checked={portFilters[opt.key] || false}
              onChange={(e) => onPortFilterChange(opt.key, e.target.checked)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <div className="filter-section filter-price">
        <span className="filter-label">
          Price: ${priceRange[0]} - ${priceRange[1]}
        </span>
        <input
          type="range"
          className="price-slider"
          min={0}
          max={maxPrice}
          step={10}
          value={priceRange[1]}
          onChange={(e) =>
            onPriceRangeChange([priceRange[0], parseInt(e.target.value, 10)])
          }
        />
      </div>
    </div>
  );
}
