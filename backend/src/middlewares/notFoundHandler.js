function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Ruta ${req.method} ${req.originalUrl} no encontrada`
  });
}

module.exports = notFoundHandler;