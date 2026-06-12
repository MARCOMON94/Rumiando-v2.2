import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RumiandoBrand() {
  return (
    <div className="rumiando-brand" aria-label="RumiAndo">
      <div className="rumiando-brand-text">
        <p>RumiAndo</p>
        <span>Gestión ganadera</span>
      </div>

      <img
        className="rumiando-brand-hero-animal"
        src="/assets/rumiando-sheep-tech-app-colors.png"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithGoogle, error } = useAuth();

  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);

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

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    setGoogleError(null);

    try {
      if (!credentialResponse.credential) {
        throw new Error('Google no devolvió una credencial válida.');
      }

      await loginWithGoogle(credentialResponse.credential);
      navigate('/home', { replace: true });
    } catch (err) {
      setGoogleError(err.message || 'No se pudo iniciar sesión con Google.');
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setGoogleError('No se pudo completar el inicio de sesión con Google.');
    setLoading(false);
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
              alt="Ganadero usando RumiAndo en una explotacion"
            />
          </div>
        </div>

        <div className="login-form-card">
          <div className="login-access-header">
            <h2>Acceso</h2>
            <p>
              Entra con la cuenta de Google autorizada para tu explotación.
            </p>
          </div>

          <div className="google-login-area">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="continue_with"
              shape="pill"
              size="large"
              logo_alignment="left"
              width="280"
              useOneTap={false}
            />
          </div>

          {loading && (
            <p className="login-status-text">
              Entrando con Google...
            </p>
          )}

          {(error || googleError) && (
            <p className="form-error">
              {error || googleError}
            </p>
          )}

          <p className="login-help-text">
            Si no puedes entrar, tu email debe estar dado de alta previamente.
          </p>
        </div>

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
