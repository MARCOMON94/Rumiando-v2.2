import { useEffect } from 'react';

export default function AppModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel = 'Cerrar',
  modalClassName = ''
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="app-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`app-modal ${modalClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>

          <button
            type="button"
            className="app-modal-close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            x
          </button>
        </header>

        {children && <div className="app-modal-body">{children}</div>}

        {footer && <footer className="app-modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}
