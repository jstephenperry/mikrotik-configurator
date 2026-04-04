import { useState, useEffect } from 'react';

/**
 * Fetches product data from the public data directory and provides
 * categorised accessors for routers, switches, etc.
 */
export default function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Vite injects import.meta.env.BASE_URL from the `base` config
        const base = import.meta.env.BASE_URL || '/';
        const url = `${base}data/products.json`;
        const resp = await fetch(url);

        if (!resp.ok) {
          throw new Error(`Failed to fetch products: ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.json();

        if (cancelled) return;

        // Flatten all categories into a single array and assign unique IDs
        const allProducts = [];
        const categories = data.products || {};
        let idCounter = 1;

        Object.entries(categories).forEach(([category, items]) => {
          items.forEach((item) => {
            allProducts.push({
              ...item,
              category: item.category || category,
              _catalogId: idCounter++,
            });
          });
        });

        setProducts(allProducts);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const routers = products.filter((p) => p.category === 'routers');
  const switches = products.filter((p) => p.category === 'switches');
  const wireless = products.filter((p) => p.category === 'wireless');
  const lte = products.filter((p) => p.category === 'lte');
  const accessories = products.filter((p) => p.category === 'accessories');

  return { products, routers, switches, wireless, lte, accessories, loading, error };
}
