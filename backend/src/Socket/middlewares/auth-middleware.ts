import { Socket } from 'socket.io';
import { TokenService } from '../../utils/Token/token.service';

export type SocketMiddleware = (
  socket: Socket,
  next: (err?: Error) => void,
) => void;

export const socketAuth = (jwtService: TokenService): SocketMiddleware => {
  return async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.split('_')[1];
      if (!token) throw new Error('Missing Token');

      const payload = jwtService.verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  };
};
