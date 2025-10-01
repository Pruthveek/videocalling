import { v4 as uuidv4 } from 'uuid';

// Configuration for RTCPeerConnection
const rtcConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
};

// Class to manage WebRTC connections
export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private peerId: string;
  private onRemoteStreamCallbacks: Map<string, (stream: MediaStream) => void> = new Map();

  constructor() {
    this.peerId = uuidv4();
  }

  // Get the local peer ID
  getPeerId(): string {
    return this.peerId;
  }

  // Initialize local media stream
  async initLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  // Get the local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Create a peer connection for a specific remote peer
  createPeerConnection(remotePeerId: string): RTCPeerConnection {
    if (this.peerConnections.has(remotePeerId)) {
      return this.peerConnections.get(remotePeerId)!;
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks to the peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    // Handle ICE candidate events
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.handleIceCandidate(remotePeerId, event.candidate);
      }
    };

    // Handle remote track events
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      const callback = this.onRemoteStreamCallbacks.get(remotePeerId);
      if (callback) {
        callback(remoteStream);
      }
    };

    this.peerConnections.set(remotePeerId, peerConnection);
    return peerConnection;
  }

  // Set callback for when a remote stream is received
  onRemoteStream(remotePeerId: string, callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallbacks.set(remotePeerId, callback);
  }

  // Create an offer for a remote peer
  async createOffer(remotePeerId: string): Promise<string> {
    const peerConnection = this.createPeerConnection(remotePeerId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return JSON.stringify(offer);
  }

  // Handle an incoming offer from a remote peer
  async handleOffer(remotePeerId: string, offerStr: string): Promise<string> {
    const peerConnection = this.createPeerConnection(remotePeerId);
    const offer = JSON.parse(offerStr);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return JSON.stringify(answer);
  }

  // Handle an incoming answer from a remote peer
  async handleAnswer(remotePeerId: string, answerStr: string): Promise<void> {
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) {
      throw new Error(`No peer connection for ${remotePeerId}`);
    }
    const answer = JSON.parse(answerStr);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  // Handle an incoming ICE candidate from a remote peer
  async handleRemoteIceCandidate(remotePeerId: string, candidateStr: string): Promise<void> {
    const peerConnection = this.peerConnections.get(remotePeerId);
    if (!peerConnection) {
      throw new Error(`No peer connection for ${remotePeerId}`);
    }
    const candidate = JSON.parse(candidateStr);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // Handle a local ICE candidate
  private handleIceCandidate(remotePeerId: string, candidate: RTCIceCandidate): void {
    // This method should be overridden by the consumer to send the candidate to the remote peer
    // We'll implement this in the React component
    const event = new CustomEvent('ice-candidate', {
      detail: {
        remotePeerId,
        candidate: JSON.stringify(candidate),
      },
    });
    window.dispatchEvent(event);
  }

  // Close all peer connections
  closeAllConnections(): void {
    this.peerConnections.forEach((connection) => {
      connection.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
  }
}