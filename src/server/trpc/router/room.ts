import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for room data
// In a production app, you might want to use a database
interface Room {
  id: string;
  participants: {
    [peerId: string]: {
      offers: {
        [targetPeerId: string]: string;
      };
      answers: {
        [targetPeerId: string]: string;
      };
      iceCandidates: {
        [targetPeerId: string]: string[];
      };
    };
  };
}

const rooms = new Map<string, Room>();

export const roomRouter = router({
  // Create a new room and return its ID
  createRoom: publicProcedure.mutation(() => {
    const roomId = uuidv4();
    rooms.set(roomId, {
      id: roomId,
      participants: {},
    });
    return { roomId };
  }),

  // Join a room with a peer ID
  joinRoom: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        peerId: z.string(),
      })
    )
    .mutation(({ input }) => {
      const { roomId, peerId } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      // Initialize participant data if not exists
      if (!room.participants[peerId]) {
        room.participants[peerId] = {
          offers: {},
          answers: {},
          iceCandidates: {},
        };
      }

      // Return list of other peers in the room
      const otherPeers = Object.keys(room.participants).filter(
        (id) => id !== peerId
      );

      return { peers: otherPeers };
    }),

  // Send an SDP offer to a peer
  sendOffer: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        fromPeerId: z.string(),
        toPeerId: z.string(),
        offer: z.string(),
      })
    )
    .mutation(({ input }) => {
      const { roomId, fromPeerId, toPeerId, offer } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      if (!room.participants[fromPeerId]) {
        throw new Error(`Peer ${fromPeerId} not found in room ${roomId}`);
      }

      // Store the offer
      room.participants[fromPeerId].offers[toPeerId] = offer;

      return { success: true };
    }),

  // Send an SDP answer to a peer
  sendAnswer: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        fromPeerId: z.string(),
        toPeerId: z.string(),
        answer: z.string(),
      })
    )
    .mutation(({ input }) => {
      const { roomId, fromPeerId, toPeerId, answer } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      if (!room.participants[fromPeerId]) {
        throw new Error(`Peer ${fromPeerId} not found in room ${roomId}`);
      }

      // Store the answer
      room.participants[fromPeerId].answers[toPeerId] = answer;

      return { success: true };
    }),

  // Send ICE candidates to a peer
  sendIceCandidate: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        fromPeerId: z.string(),
        toPeerId: z.string(),
        candidate: z.string(),
      })
    )
    .mutation(({ input }) => {
      const { roomId, fromPeerId, toPeerId, candidate } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      if (!room.participants[fromPeerId]) {
        throw new Error(`Peer ${fromPeerId} not found in room ${roomId}`);
      }

      // Initialize ice candidates array if not exists
      if (!room.participants[fromPeerId].iceCandidates[toPeerId]) {
        room.participants[fromPeerId].iceCandidates[toPeerId] = [];
      }

      // Store the ice candidate
      room.participants[fromPeerId].iceCandidates[toPeerId].push(candidate);

      return { success: true };
    }),

  // Get offers for a peer
  getOffers: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        peerId: z.string(),
      })
    )
    .query(({ input }) => {
      const { roomId, peerId } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const offers: { fromPeerId: string; offer: string }[] = [];

      // Collect all offers for this peer
      Object.entries(room.participants).forEach(([fromPeerId, data]) => {
        if (fromPeerId !== peerId && data.offers[peerId]) {
          offers.push({
            fromPeerId,
            offer: data.offers[peerId],
          });
        }
      });

      return { offers };
    }),

  // Get answers for a peer
  getAnswers: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        peerId: z.string(),
      })
    )
    .query(({ input }) => {
      const { roomId, peerId } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const answers: { fromPeerId: string; answer: string }[] = [];

      // Collect all answers for this peer
      Object.entries(room.participants).forEach(([fromPeerId, data]) => {
        if (fromPeerId !== peerId && data.answers[peerId]) {
          answers.push({
            fromPeerId,
            answer: data.answers[peerId],
          });
        }
      });

      return { answers };
    }),

  // Get ICE candidates for a peer
  getIceCandidates: publicProcedure
    .input(
      z.object({
        roomId: z.string(),
        peerId: z.string(),
      })
    )
    .query(({ input }) => {
      const { roomId, peerId } = input;
      const room = rooms.get(roomId);

      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const iceCandidates: { fromPeerId: string; candidates: string[] }[] = [];

      // Collect all ice candidates for this peer
      Object.entries(room.participants).forEach(([fromPeerId, data]) => {
        if (
          fromPeerId !== peerId &&
          data.iceCandidates[peerId] &&
          data.iceCandidates[peerId].length > 0
        ) {
          iceCandidates.push({
            fromPeerId,
            candidates: data.iceCandidates[peerId],
          });
          
          // Clear the candidates after they've been retrieved
          data.iceCandidates[peerId] = [];
        }
      });

      return { iceCandidates };
    }),
});