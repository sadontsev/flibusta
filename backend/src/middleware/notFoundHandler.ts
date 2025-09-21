import { Request, Response, NextFunction } from 'express';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error: ErrorWithStatusCode = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export default notFoundHandler;
