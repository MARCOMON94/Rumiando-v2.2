import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RumiandoBrand() {
  return (
    <div className="rumiando-brand" aria-label="RumiAndo">
      <img
        className="rumiando-brand-animal"
        src="/assets/rumiando-sheep-facing-left.png"
        alt=""
        aria-hidden="true"
      />

      <div className="rumiando-brand-text">
        <p>RUMIANDO</p>
        <span>Gestión ganadera</span>
      </div>

      <img
        className="rumiando-brand-animal"
        src="/assets/rumiando-sheep-facing-right.png"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <img
      className="google-icon-img"
      src="/assets/icono_google.png"
      alt=""
      aria-hidden="true"
    />
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialHeight = window.innerHeight;

    document.documentElement.style.setProperty('--login-height', `${initialHeight}px`);
    document.body.classList.add('login-body-lock');

    function keepPageStill() {
      window.scrollTo(0, 0);
    }

    window.addEventListener('scroll', keepPageStill, { passive: true });

    return () => {
      document.body.classList.remove('login-body-lock');
      document.documentElement.style.removeProperty('--login-height');
      window.removeEventListener('scroll', keepPageStill);
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleFocus() {
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/home', { replace: true });
    } catch {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Inicio de sesión RumiAndo">
        <div className="login-intro">
  <RumiandoBrand />

  <div className="login-copy">
    <h1>Tu ayuda en el campo</h1>
  </div>

  <div className="login-desktop-image">
    <img
      src="/assets/login-farm-desktop.png"
      alt="Ganadero usando RumiAndo en una explotación"
    />
  </div>
</div>

        <form className="login-form-card" onSubmit={handleSubmit}>
  <div>
    <h2>Acceso</h2>
  </div>

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={handleFocus}
              placeholder="admin@rumiando.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={handleFocus}
              placeholder="Introduce tu contraseña"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="login-submit-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button type="button" className="google-login-button" disabled>
            <GoogleIcon />
            <span>Continuar con Google</span>
          </button>
        </form>

        <div className="login-description-card">
          <p>
            Consulta animales, registra movimientos, revisa avisos y apóyate
            en el asistente para trabajar con más claridad desde la granja.
          </p>
        </div>
      </section>
    </main>
  );
}