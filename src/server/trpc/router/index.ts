import { router } from '../trpc';
import { roomRouter } from './room';

export const appRouter = router({
  room: roomRouter,
});

export type AppRouter = typeof appRouter;