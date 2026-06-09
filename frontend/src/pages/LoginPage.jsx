import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value
    }));
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
          <div className="login-brand-row">
            <div className="brand-mark">R</div>
            <div>
              <p className="eyebrow">RumiAndo v2</p>
              <span>Gestión ganadera</span>
            </div>
          </div>

          <div className="login-copy">
            <h1>Gestión ganadera clara, trazable y conectada</h1>
            <p>
              Panel web para consultar animales, corrales, avisos automáticos,
              sanidad y movimientos de una explotación ovina/caprina.
            </p>
          </div>
        </div>

        <form className="login-form-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Acceso</p>
            <h2>Iniciar sesión</h2>
          </div>

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
            Continuar con Google
          </button>

          <p className="login-help-text">
            El acceso con Google queda reservado para una fase posterior.
          </p>
        </form>
      </section>
    </main>
  );
}