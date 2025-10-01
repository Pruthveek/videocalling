'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { VideoPlayer } from '@/components/VideoPlayer';
import { WebRTCManager } from '@/utils/webrtc';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const [peerId] = useState(() => uuidv4());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [webRTCManager, setWebRTCManager] = useState<WebRTCManager | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // tRPC hooks
  const joinRoomMutation = trpc.room.joinRoom.useMutation();
  const sendOfferMutation = trpc.room.sendOffer.useMutation();
  const sendAnswerMutation = trpc.room.sendAnswer.useMutation();
  const sendIceCandidateMutation = trpc.room.sendIceCandidate.useMutation();
  
  const offersQuery = trpc.room.getOffers.useQuery(
    { roomId, peerId },
    { refetchInterval: 1000 }
  );
  
  const answersQuery = trpc.room.getAnswers.useQuery(
    { roomId, peerId },
    { refetchInterval: 1000 }
  );
  
  const iceCandidatesQuery = trpc.room.getIceCandidates.useQuery(
    { roomId, peerId },
    { refetchInterval: 1000 }
  );

  // Initialize WebRTC and join room
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Create WebRTC manager
        const manager = new WebRTCManager();
        setWebRTCManager(manager);

        // Initialize local stream
        const stream = await manager.initLocalStream();
        setLocalStream(stream);

        // Join the room
        const result = await joinRoomMutation.mutateAsync({ roomId, peerId });

        // Set up event listener for ICE candidates
        const handleIceCandidate = (event: Event) => {
          const customEvent = event as CustomEvent;
          const { remotePeerId, candidate } = customEvent.detail;
          
          sendIceCandidateMutation.mutate({
            roomId,
            fromPeerId: peerId,
            toPeerId: remotePeerId,
            candidate,
          });
        };

        window.addEventListener('ice-candidate', handleIceCandidate);

        // For each existing peer, create an offer
        for (const remotePeerId of result.peers) {
          createOffer(manager, remotePeerId);
        }

        // Set room URL for sharing
        setRoomUrl(window.location.href);

        return () => {
          window.removeEventListener('ice-candidate', handleIceCandidate);
          manager.closeAllConnections();
        };
      } catch (err) {
        console.error('Failed to initialize WebRTC:', err);
        setError('Failed to access camera and microphone. Please ensure you have granted the necessary permissions.');
      }
    };

    initWebRTC();
  }, [roomId, peerId]);

  // Handle incoming offers
  useEffect(() => {
    const handleOffers = async () => {
      if (!webRTCManager || !offersQuery.data) return;

      for (const { fromPeerId, offer } of offersQuery.data.offers) {
        try {
          // Set up remote stream handler
          webRTCManager.onRemoteStream(fromPeerId, (stream) => {
            setRemoteStreams((prev) => {
              const newStreams = new Map(prev);
              newStreams.set(fromPeerId, stream);
              return newStreams;
            });
          });

          // Create and send answer
          const answer = await webRTCManager.handleOffer(fromPeerId, offer);
          await sendAnswerMutation.mutateAsync({
            roomId,
            fromPeerId: peerId,
            toPeerId: fromPeerId,
            answer,
          });
        } catch (err) {
          console.error('Error handling offer:', err);
        }
      }
    };

    handleOffers();
  }, [offersQuery.data, webRTCManager]);

  // Handle incoming answers
  useEffect(() => {
    const handleAnswers = async () => {
      if (!webRTCManager || !answersQuery.data) return;

      for (const { fromPeerId, answer } of answersQuery.data.answers) {
        try {
          await webRTCManager.handleAnswer(fromPeerId, answer);
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      }
    };

    handleAnswers();
  }, [answersQuery.data, webRTCManager]);

  // Handle incoming ICE candidates
  useEffect(() => {
    const handleIceCandidates = async () => {
      if (!webRTCManager || !iceCandidatesQuery.data) return;

      for (const { fromPeerId, candidates } of iceCandidatesQuery.data.iceCandidates) {
        for (const candidate of candidates) {
          try {
            await webRTCManager.handleRemoteIceCandidate(fromPeerId, candidate);
          } catch (err) {
            console.error('Error handling ICE candidate:', err);
          }
        }
      }
    };

    handleIceCandidates();
  }, [iceCandidatesQuery.data, webRTCManager]);

  // Create an offer for a remote peer
  const createOffer = async (manager: WebRTCManager, remotePeerId: string) => {
    try {
      // Set up remote stream handler
      manager.onRemoteStream(remotePeerId, (stream) => {
        setRemoteStreams((prev) => {
          const newStreams = new Map(prev);
          newStreams.set(remotePeerId, stream);
          return newStreams;
        });
      });

      // Create and send offer
      const offer = await manager.createOffer(remotePeerId);
      await sendOfferMutation.mutateAsync({
        roomId,
        fromPeerId: peerId,
        toPeerId: remotePeerId,
        offer,
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };

  // Copy room URL to clipboard
  const copyRoomUrl = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert remoteStreams Map to array for rendering
  const remoteStreamsArray = Array.from(remoteStreams.values());

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md text-center">
          <div className="text-red-500">{error}</div>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Room: {roomId.substring(0, 8)}...</h1>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomUrl}
              readOnly
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
            />
            <button
              onClick={copyRoomUrl}
              className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <Link href="/" className="px-3 py-2 bg-gray-600 text-white rounded-md text-sm">
              Leave
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local video */}
          <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
            {localStream ? (
              <VideoPlayer stream={localStream} muted={true} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                Loading camera...
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              You
            </div>
          </div>

          {/* Remote videos */}
          {remoteStreamsArray.length > 0 ? (
            remoteStreamsArray.map((stream, index) => (
              <div key={index} className="bg-black rounded-lg overflow-hidden aspect-video relative">
                <VideoPlayer stream={stream} />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  Remote User
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center text-white">
              Waiting for others to join...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}