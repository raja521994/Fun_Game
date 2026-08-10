const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      req.body = parsed.body || req.body;
      req.params = parsed.params || req.params;
      req.query = parsed.query || req.query;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };
}

const roomCodeSchema = z.string().length(6).regex(/^[A-Z0-9]+$/i);
const nameSchema = z.string().min(1).max(40).transform((s) => s.trim());

module.exports = { validate, roomCodeSchema, nameSchema, z };
