import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveVideoRoom, User, VideoParticipantState } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { getTtsPrompt, AGORA_APP_ID } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { useSettings } from '../contexts/SettingsContext';

interface LiveVideoRoomScreenProps {
  currentUser: User;
  roomId: string;
  onGoBack: () => void;
  onSetTtsMessage: (message: string) => void;
}


// Participant Video Component
const ParticipantVideo: React.FC<{
    participant: VideoParticipantState;
    isLocal: boolean;
    isHost: boolean;
    isSpeaking: boolean;
    localVideoTrack: ICameraVideoTrack | null;
    remoteUser: IAgoraRTCRemoteUser | undefined;
}> = ({ participant, isLocal, isHost, isSpeaking, localVideoTrack, remoteUser }) => {
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Effect to play video tracks
    useEffect(() => {
        const videoContainer = videoContainerRef.current;
        if (!videoContainer) return;

        if (isLocal) {
            if (localVideoTrack && !participant.isCameraOff) {
                localVideoTrack.play(videoContainer);
            } else {
                localVideoTrack?.stop();
            }
        } else {
            if (remoteUser?.hasVideo && !participant.isCameraOff) {
                remoteUser.videoTrack?.play(videoContainer);
            } else {
                remoteUser?.videoTrack?.stop();
            }
        }
        
        return () => {
            if (isLocal) localVideoTrack?.stop();
            else remoteUser?.videoTrack?.stop();
        }

    }, [isLocal, localVideoTrack, remoteUser, participant.isCameraOff]);

    const showVideo = (isLocal && localVideoTrack && !participant.isCameraOff) || (remoteUser?.hasVideo && !participant.isCameraOff);

    return (
        <div className="relative aspect-square bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
            {showVideo ? (
                <div ref={videoContainerRef} className={`w-full h-full ${isLocal ? 'transform scale-x-[-1]' : ''}`} />
            ) : (
                <>
                    <img src={participant.avatarUrl} alt={participant.name} className="w-full h-full object-cover opacity-30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img src={participant.avatarUrl} alt={participant.name} className="w-20 h-20 rounded-full" />
                    </div>
                </>
            )}
             {(participant.isCameraOff || (!isLocal && !remoteUser?.hasVideo)) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Icon name="video-camera-slash" className="w-10 h-10 text-slate-400" />
                </div>
            )}
            <div className={`absolute inset-0 border-4 rounded-lg pointer-events-none transition-colors ${isSpeaking ? 'border-green-400' : 'border-transparent'}`} />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md text-sm text-white font-semibold flex items-center gap-1">
                {isHost && '👑'} {participant.name}
            </div>
             {participant.isMuted && (
                <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full">
                    <Icon name="microphone-slash" className="w-4 h-4 text-white" />
                </div>
             )}
        </div>
    );
};

// Main Component
const LiveVideoRoomScreen: React.FC<LiveVideoRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveVideoRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
    const [localVideoTrackState, setLocalVideoTrackState] = useState<ICameraVideoTrack | null>(null); // For re-rendering
    const { language } = useSettings();

    // Agora Lifecycle Management
    useEffect(() => {
        if (!AGORA_APP_ID) {
            onSetTtsMessage("Agora App ID is not configured. Real-time video will not work.");
            console.error("Agora App ID is not configured in constants.ts");
            onGoBack();
            return;
        }

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClient.current = client;

        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
            await client.subscribe(user, mediaType);
            if (mediaType === 'audio') {
                user.audioTrack?.play();
            }
            setRemoteUsers(Array.from(client.remoteUsers));
        };

        const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
            setRemoteUsers(Array.from(client.remoteUsers));
        };

        const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        };
        
        const handleVolumeIndicator = (volumes: any[]) => {
            if (volumes.length === 0) {
                setActiveSpeakerId(null);
                return;
            };
            const mainSpeaker = volumes.reduce((max, current) => current.level > max.level ? current : max);
            if (mainSpeaker.level > 5) { // Threshold to avoid flickering
                setActiveSpeakerId(mainSpeaker.uid.toString());
            } else {
                setActiveSpeakerId(null);
            }
        };

        const joinAndPublish = async () => {
            try {
                client.on('user-published', handleUserPublished);
                client.on('user-unpublished', handleUserUnpublished);
                client.on('user-left', handleUserLeft);
                client.enableAudioVolumeIndicator();
                client.on('volume-indicator', handleVolumeIndicator);

                const token = await geminiService.getAgoraToken(roomId, currentUser.id);
                if (!token) {
                    throw new Error("Failed to retrieve Agora token. The video call cannot proceed.");
                }
                await client.join(AGORA_APP_ID, roomId, token, currentUser.id);

                const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                localAudioTrack.current = audioTrack;
                localVideoTrack.current = videoTrack;
                setLocalVideoTrackState(videoTrack);

                await client.publish([audioTrack, videoTrack]);
            } catch (error: any) {
                console.error("Agora failed to join or publish:", error);
                if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' || error.code === 'DEVICE_NOT_FOUND') {
                    onSetTtsMessage("Could not find a microphone or camera. Please check your devices and permissions.");
                } else if (error.name === 'NotAllowedError' || error.code === 'PERMISSION_DENIED') {
                    onSetTtsMessage("Microphone/camera access was denied. Please allow access in your browser settings.");
                } else {
                    onSetTtsMessage(`Could not start the video room: ${error.message || 'Unknown error'}`);
                }
                onGoBack();
            }
        };

        geminiService.joinLiveVideoRoom(currentUser.id, roomId).then(joinAndPublish);

        return () => {
            client.off('user-published', handleUserPublished);
            client.off('user-unpublished', handleUserUnpublished);
            client.off('user-left', handleUserLeft);
            client.off('volume-indicator', handleVolumeIndicator);

            localAudioTrack.current?.stop();
            localAudioTrack.current?.close();
            localVideoTrack.current?.stop();
            localVideoTrack.current?.close();

            client.leave();
            geminiService.leaveLiveVideoRoom(currentUser.id, roomId);
        };
    }, [roomId, currentUser.id, onGoBack, onSetTtsMessage, language]);
    
    // Firestore real-time listener for Room Metadata
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = geminiService.listenToVideoRoom(roomId, (roomDetails) => {
            if (roomDetails) {
                setRoom(roomDetails);
            } else {
                onGoBack(); // Room has ended or doesn't exist
            }
            setIsLoading(false);
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, [roomId, onGoBack]);
    
    const toggleMute = () => {
        if (!localAudioTrack.current) return;
        const muted = !isMuted;
        localAudioTrack.current.setMuted(muted);
        setIsMuted(muted);
    };

    const toggleCamera = () => {
        if (!localVideoTrack.current) return;
        const cameraOff = !isCameraOff;
        localVideoTrack.current.setEnabled(!cameraOff);
        setIsCameraOff(cameraOff);
    };
    
    const remoteUsersMap = useMemo(() => {
        const map: Record<string, IAgoraRTCRemoteUser> = {};
        remoteUsers.forEach(user => {
            map[user.uid.toString()] = user;
        });
        return map;
    }, [remoteUsers]);
    
    if (isLoading || !room) {
        return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">Loading Video Room...</div>;
    }
    
    const allParticipants = [
        ...room.participants,
        { ...currentUser, isMuted, isCameraOff }
    ];
    
    const participantsMap = new Map<string, VideoParticipantState>();
    allParticipants.forEach(p => participantsMap.set(p.id, { ...p, isMuted: remoteUsersMap[p.id]?.audioTrack ? p.isMuted : true, isCameraOff: remoteUsersMap[p.id]?.videoTrack ? p.isCameraOff : true }));
    participantsMap.set(currentUser.id, { ...currentUser, isMuted, isCameraOff });

    const participantsWithLocal = Array.from(participantsMap.values())
        .sort((a, b) => {
            if (a.id === room.host.id) return -1;
            if (b.id === room.host.id) return 1;
            if (a.id === currentUser.id) return -1;
            if (b.id === currentUser.id) return 1;
            return a.name.localeCompare(b.name);
        });
    
    return (
        <div className="h-full w-full flex flex-col bg-slate-900 text-white">
            <header className="flex-shrink-0 p-4 flex justify-between items-center bg-black/20">
                <div>
                    <h1 className="text-xl font-bold truncate">{room.topic}</h1>
                    <p className="text-sm text-slate-400">{participantsWithLocal.length} participant(s)</p>
                </div>
                <button onClick={onGoBack} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-4 rounded-lg">
                    Leave
                </button>
            </header>

            <main className="flex-grow p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-min overflow-y-auto">
                {participantsWithLocal.map(p => (
                    <ParticipantVideo
                        key={p.id}
                        participant={p}
                        isLocal={p.id === currentUser.id}
                        isHost={p.id === room.host.id}
                        isSpeaking={p.id === activeSpeakerId}
                        localVideoTrack={localVideoTrackState}
                        remoteUser={remoteUsersMap[p.id]}
                    />
                ))}
            </main>

            <footer className="flex-shrink-0 p-4 bg-black/20 flex justify-center items-center h-24 gap-6">
                 <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                    <Icon name={isMuted ? 'microphone-slash' : 'mic'} className="w-6 h-6" />
                </button>
                 <button onClick={toggleCamera} className={`p-4 rounded-full transition-colors ${isCameraOff ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                    <Icon name={isCameraOff ? 'video-camera-slash' : 'video-camera'} className="w-6 h-6" />
                </button>
            </footer>
        </div>
    );
};

export default LiveVideoRoomScreen;