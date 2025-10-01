'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

export default function Home() {
  const [joinRoomId, setJoinRoomId] = useState('');
  const createRoomMutation = trpc.room.createRoom.useMutation();

  const handleCreateRoom = async () => {
    try {
      const result = await createRoomMutation.mutateAsync();
      window.location.href = `/room/${result.roomId}`;
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinRoomId.trim()) {
      window.location.href = `/room/${joinRoomId}`;
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Video Calling App</h1>
          <p className="mt-2 text-gray-600">Connect with others through video calls</p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={handleCreateRoom}
            disabled={createRoomMutation.isPending}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {createRoomMutation.isPending ? 'Creating...' : 'Create New Room'}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or join existing</span>
            </div>
          </div>
          
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label htmlFor="roomId" className="sr-only">Room ID</label>
              <input
                id="roomId"
                name="roomId"
                type="text"
                required
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter Room ID"
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
