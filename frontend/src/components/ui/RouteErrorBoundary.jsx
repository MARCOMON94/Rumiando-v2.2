import { Component } from 'react';

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.locationKey !== this.props.locationKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="page">
        <article className="panel">
          <h2>No se pudo abrir esta pantalla</h2>
          <p className="muted">
            Se ha recuperado la app para que no quede en blanco. Vuelve a intentarlo o abre Inicio.
          </p>
          <p className="alert error">Error: {this.state.error.message}</p>
        </article>
      </section>
    );
  }
}
