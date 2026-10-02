import { useEffect, useMemo, useState } from 'react';
import { products } from './data/products';
import type { CartItem, Product } from './types/product';

const API = 'https://api.github.com/repos/oluwadaraadedayo-creator/Afroskankin/contents';

function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [heroUrl, setHeroUrl] = useState('');

  useEffect(() => {
    fetch(API)
      .then((response) => response.ok ? response.json() : [])
      .then((files: Array<{ name: string; download_url: string }>) => {
        const video = files.find((file) => /\.mp4$/i.test(file.name) && /models.?walking.?runway/i.test(file.name))
          ?? files.find((file) => /\.mp4$/i.test(file.name));
        if (video) setHeroUrl(video.download_url);
      })
      .catch(() => undefined);
  }, []);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart],
  );

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const changeQuantity = (id: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0),
    );
  };

  const money = (value: number) => `₦${value.toLocaleString('en-NG')}`;

  return (
    <div className="site">
      <nav className="nav">
        <a className="brand" href="#top">
          <img src="/Afroskankin/logo.png" alt="Paybac Iboro" />
        </a>
        <div className="nav-links">
          <a href="#shop">SHOP</a>
          <button onClick={() => setCartOpen(true)}>CART ({cartCount})</button>
        </div>
      </nav>

      <main id="top">
        <section className="hero">
          {heroUrl ? (
            <video className="hero-video" src={heroUrl} autoPlay muted loop playsInline />
          ) : (
            <div className="hero-loading">
              <span>PAYBAC IBORO</span>
              <small>COLLECTION 01</small>
            </div>
          )}
        </section>

        <section id="shop" className="shop">
          <div className="heading">
            <span>PAYBAC IBORO / COLLECTION 01</span>
            <h1>SHOP THE<br />COLLECTION</h1>
          </div>

          <div className="products">
            {products.map((product, index) => (
              <article className="product" key={product.id}>
                <div className={`product-art art-${index + 1}`}>
                  <span>PAYBAC<br />IBORO</span>
                </div>
                <div className="product-info">
                  <div>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                  </div>
                  <div className="product-action">
                    <strong>{money(product.price)}</strong>
                    <button onClick={() => addToCart(product)}>ADD TO CART</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>PAYBAC IBORO</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>

      {cartOpen && (
        <>
          <button className="overlay" aria-label="Close cart" onClick={() => setCartOpen(false)} />
          <aside className="cart">
            <div className="cart-head">
              <h2>YOUR CART</h2>
              <button onClick={() => setCartOpen(false)}>×</button>
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <p className="empty">Your cart is empty.</p>
              ) : cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <strong>{money(item.price)}</strong>
                  </div>
                  <div className="quantity">
                    <button onClick={() => changeQuantity(item.id, -1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-total">
              <span>TOTAL</span>
              <strong>{money(cartTotal)}</strong>
            </div>
            <button className="checkout" disabled={cart.length === 0}>
              CHECKOUT
            </button>
            <small>Paystack checkout will be connected after the storefront is confirmed.</small>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
