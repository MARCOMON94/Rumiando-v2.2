import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const loadInvitation = useCallback(async function loadInvitation() {
    setLoading(true);
    setError('');

    try {
      const data = await get(`/invitations/validate/${token}`);
      setInvitation(data.invitation);
    } catch (err) {
      setInvitation(null);
      setError(err.message || 'No se pudo validar la invitación');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  async function handleGoogleSuccess(credentialResponse) {
    setAccepting(true);
    setError('');

    try {
      if (!credentialResponse.credential) {
        throw new Error('Google no devolvió una credencial válida.');
      }

      await post('/invitations/accept-google', {
        token,
        credential: credentialResponse.credential
      });

      await refreshUser();

      navigate('/home', {
        replace: true
      });
    } catch (err) {
      setError(err.message || 'No se pudo aceptar la invitación');
      setAccepting(false);
    }
  }

  function handleGoogleError() {
    setError('No se pudo completar el inicio de sesión con Google.');
    setAccepting(false);
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Aceptar invitación RumiAndo">
        <div className="login-intro">
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

          <div className="login-copy">
            <h1>Invitación de acceso</h1>
          </div>

          <div className="login-desktop-image">
            <img
              src="/assets/login-farm-desktop.png"
              alt="Ganadero usando RumiAndo en una explotación"
            />
          </div>
        </div>

        <div className="login-form-card">
          {loading && (
            <div className="login-access-header">
              <h2>Comprobando</h2>
              <p>Estamos validando la invitación.</p>
            </div>
          )}

          {!loading && error && !invitation && (
            <div className="login-access-header">
              <h2>Invitación no válida</h2>
              <p>{error}</p>
            </div>
          )}

          {!loading && invitation && (
            <>
              <div className="login-access-header">
                <h2>Aceptar acceso</h2>
                <p>
                  Has sido invitado a entrar en{' '}
                  <strong>{invitation.cuentaGanadera?.nombre || 'RumiAndo'}</strong>.
                </p>
              </div>

              <p className="login-help-text">
                Email invitado: <strong>{invitation.email}</strong>
              </p>

              <p className="login-help-text">
                Rol: <strong>{invitation.rol}</strong>
              </p>

              <p className="login-help-text">
                Caduca: <strong>{formatDate(invitation.expiresAt)}</strong>
              </p>

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

              {accepting && (
                <p className="login-status-text">
                  Aceptando invitación...
                </p>
              )}

              {error && (
                <p className="form-error">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="login-description-card">
          <p>
            El acceso se vincula a tu cuenta de Google. No necesitas crear ni
            guardar contraseñas en RumiAndo.
          </p>
        </div>
      </section>
    </main>
  );
}
