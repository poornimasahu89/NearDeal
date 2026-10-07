/**
 * Global error handler.
 *
 * Every client in this app reads `data.message` off a JSON body, so an error
 * must never leak through as an HTML page or as a raw Mongoose driver error.
 * The three Mongoose error shapes are mapped to the HTTP semantics the API
 * documents: an unparseable id is a bad request, a schema validation failure
 * is a bad request, and a duplicate key is a conflict.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Server error';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message =
      Object.values(err.errors || {})
        .map((e) => e.message)
        .filter(Boolean)
        .join(', ') || 'Invalid request body';
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    message = `Duplicate value for "${field || 'field'}"`;
  } else if (err.type === 'entity.parse.failed'
    || (err instanceof SyntaxError && err.status === 400 && err.body !== undefined)) {
    // express.json() rejected an unparseable payload. Without this the raw
    // SyntaxError falls through as a 500, which tells the client nothing about
    // the fact that its request body was the problem.
    statusCode = 400;
    message = 'Invalid JSON body';
  }

  console.error(err.stack);

  res.status(statusCode).json({
    status: 'error',
    message,
    // The stack is debugging information, not part of the contract — it is
    // only ever handed back to a local developer.
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

module.exports = { errorHandler };
