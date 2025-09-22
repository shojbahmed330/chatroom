
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveAudioRoom, User, AppView, LiveAudioRoomMessage } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { AGORA_APP_ID } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { useSettings } from '../contexts/SettingsContext';

interface LiveRoomScreenProps {
  currentUser: User;
  roomId: string;
  onGoBack: () => void;
  onSetTtsMessage: (message: string) => void;
  onOpenProfile: (username: string) => void;
}

const ParticipantCard: React.FC<{
    participant: User;
    isHost: boolean;
    isMuted: boolean;
    isSpeaking: boolean;
    onClick: () => void;
}> = ({ participant, isHost, isMuted, isSpeaking, onClick }) => (
    <div className="flex flex-col items-center text-center relative" onClick={onClick}>
        <div className={`relative rounded-full p-1 transition-all duration-300 ${isSpeaking ? 'bg-green-500/50' : 'bg-transparent'}`}>
            <img src={participant.avatarUrl} alt={participant.name} className="w-20 h-20 rounded-full" />
            {isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-slate-700 p-1.5 rounded-full border-2 border-slate-900">
                    <Icon name="microphone-slash" className="w-4 h-4 text-white" />
                </div>
            )}
        </div>
        <p className="mt-2 font-semibold text-slate-100 truncate w-24">{participant.name}</p>
        {isHost && <p className="text-xs text-amber-400">Host</p>}
    </div>
);


const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage, onOpenProfile }) => {
    const [room, setRoom] = useState<LiveAudioRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
    const [messages, setMessages] = useState<LiveAudioRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const { language } = useSettings();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isHost = room?.host.id === currentUser.id;

    // Firestore listener for room data
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = geminiService.listenToAudioRoom(roomId, async (roomDetails) => {
            if (roomDetails) {
                setRoom(roomDetails);
                const amISpeaker = roomDetails.speakers.some(s => s.id === currentUser.id);
                if (isSpeaking !== amISpeaker) { // Role changed
                    setIsSpeaking(amISpeaker);
                    if (amISpeaker) {
                        await localAudioTrack.current?.setMuted(false);
                        setIsMuted(false);
                    } else {
                        await localAudioTrack.current?.setMuted(true);
                        setIsMuted(true);
                    }
                }
            } else {
                onGoBack(); // Room ended
            }
            setIsLoading(false);
        });
        return unsubscribe;
    }, [roomId, currentUser.id, onGoBack, isSpeaking]);

    // Agora setup
    useEffect(() => {
        if (!AGORA_APP_ID) {
            onSetTtsMessage("Agora App ID is not configured.");
            onGoBack();
            return;
        }

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClient.current = client;

        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
            await client.subscribe(user, mediaType);
            if (mediaType === 'audio') user.audioTrack?.play();
        };

        const handleVolumeIndicator = (volumes: any[]) => {
            if (volumes.length === 0) { setActiveSpeakerId(null); return; };
            const mainSpeaker = volumes.reduce((max, current) => current.level > max.level ? current : max);
            setActiveSpeakerId(mainSpeaker.level > 5 ? mainSpeaker.uid.toString() : null);
        };
        
        const joinAndPublish = async () => {
            try {
                client.on('user-published', handleUserPublished);
                client.enableAudioVolumeIndicator();
                client.on('volume-indicator', handleVolumeIndicator);
                
                const token = await geminiService.getAgoraToken(roomId, currentUser.id);
                if (!token) throw new Error("Failed to get Agora token.");
                await client.join(AGORA_APP_ID, roomId, token, currentUser.id);

                localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
                await client.publish([localAudioTrack.current]);

                // Initial mute state determined by speaker status
                const amISpeaker = room?.speakers.some(s => s.id === currentUser.id);
                await localAudioTrack.current.setMuted(!amISpeaker);
                setIsMuted(!amISpeaker);
                setIsSpeaking(!!amISpeaker);

            } catch (error: any) {
                onSetTtsMessage(`Could not join the room: ${error.message || 'Unknown error'}`);
                onGoBack();
            }
        };

        geminiService.joinLiveAudioRoom(currentUser.id, roomId).then(joinAndPublish);

        return () => {
            client.off('user-published', handleUserPublished);
            client.off('volume-indicator', handleVolumeIndicator);
            localAudioTrack.current?.stop();
            localAudioTrack.current?.close();
            client.leave();
            geminiService.leaveLiveAudioRoom(currentUser.id, roomId);
        };
    }, [roomId, currentUser.id, onGoBack, onSetTtsMessage, room?.speakers]);

    // Chat listener
    useEffect(() => {
        const unsubscribe = geminiService.listenToLiveAudioRoomMessages(roomId, setMessages);
        return unsubscribe;
    }, [roomId]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isChatOpen]);

    const toggleMute = () => {
        if (isSpeaking) {
            const muted = !isMuted;
            localAudioTrack.current?.setMuted(muted);
            setIsMuted(muted);
        } else {
            handleRaiseHand();
        }
    };
    
    const handleLeave = () => {
        if (isHost) {
            geminiService.endLiveAudioRoom(currentUser.id, roomId);
        }
        onGoBack();
    }

    const handleRaiseHand = () => {
        geminiService.raiseHandInAudioRoom(currentUser.id, roomId);
        onSetTtsMessage("You've raised your hand to speak.");
    };

    const handleInviteToSpeak = (userId: string) => {
        geminiService.inviteToSpeakInAudioRoom(currentUser.id, userId, roomId);
    }
    
    const handleMoveToAudience = (userId: string) => {
        geminiService.moveToAudienceInAudioRoom(currentUser.id, userId, roomId);
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !room) return;
        await geminiService.sendLiveAudioRoomMessage(roomId, currentUser, newMessage.trim(), isHost, isSpeaking);
        setNewMessage('');
    };

    if (isLoading || !room) {
        return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">Loading Room...</div>;
    }
    
    const hasRaisedHand = room.raisedHands.includes(currentUser.id);

    return (
        <div className="h-full w-full flex flex-col bg-slate-900 text-white">
            <header className="flex-shrink-0 p-4 flex justify-between items-center bg-black/20">
                <h1 className="text-xl font-bold truncate">{room.topic}</h1>
                <button onClick={handleLeave} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-4 rounded-lg">
                    {isHost ? 'End Room' : 'Leave Quietly'}
                </button>
            </header>

            <main className="flex-grow p-4 overflow-y-auto">
                <h2 className="text-lg font-bold text-lime-400 mb-4">Speakers ({room.speakers.length})</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {room.speakers.map(s => (
                        <ParticipantCard key={s.id} participant={s} isHost={s.id === room.host.id} isMuted={s.id === currentUser.id && isMuted} isSpeaking={s.id === activeSpeakerId} onClick={() => isHost && s.id !== room.host.id && handleMoveToAudience(s.id)} />
                    ))}
                </div>

                <h2 className="text-lg font-bold text-lime-400 mt-8 mb-4">Listeners ({room.listeners.length})</h2>
                 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {room.listeners.map(l => (
                         <ParticipantCard key={l.id} participant={l} isHost={false} isMuted={true} isSpeaking={false} onClick={() => onOpenProfile(l.username)} />
                    ))}
                </div>
                
                {isHost && room.raisedHands.length > 0 && (
                    <>
                        <h2 className="text-lg font-bold text-yellow-400 mt-8 mb-4">Raised Hands ({room.raisedHands.length})</h2>
                        <div className="flex flex-wrap gap-4">
                            {room.raisedHands.map(userId => {
                                const user = [...room.listeners, ...room.speakers].find(u => u.id === userId);
                                return user ? (
                                    <div key={userId} className="bg-slate-800 p-2 rounded-lg flex items-center gap-2">
                                        <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full"/>
                                        <span className="font-semibold text-sm">{user.name}</span>
                                        <button onClick={() => handleInviteToSpeak(userId)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">Invite</button>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </>
                )}
            </main>
            
            <div className={`absolute bottom-24 right-4 w-80 h-[60%] bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-2xl flex flex-col transition-all duration-300 ${isChatOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                 <div className="flex-grow p-3 overflow-y-auto space-y-3">
                    {messages.map(msg => (
                        <div key={msg.id} className="flex items-start gap-2">
                           <img src={msg.sender.avatarUrl} alt={msg.sender.name} className="w-8 h-8 rounded-full"/>
                           <div>
                               <p className="text-xs"><span className="font-bold text-lime-300">{msg.sender.name}</span> {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                               <p className="text-sm bg-slate-700/50 px-2 py-1 rounded-md inline-block">{msg.text}</p>
                           </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                 </div>
                 <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-700 flex-shrink-0 flex gap-2">
                     <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Send a message..." className="flex-grow bg-slate-700 rounded-full px-3 py-1.5 text-sm"/>
                     <button type="submit" className="bg-lime-600 text-black p-2 rounded-full"><Icon name="paper-airplane" className="w-4 h-4"/></button>
                 </form>
            </div>
            
            <footer className="flex-shrink-0 p-4 bg-black/20 flex justify-center items-center h-24 gap-6">
                 <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-slate-600' : 'bg-green-600'} ${hasRaisedHand ? 'animate-pulse' : ''}`}>
                    <Icon name={isMuted ? (isSpeaking ? 'microphone-slash' : 'mic') : 'mic'} className="w-8 h-8" />
                </button>
                 <button onClick={() => setIsChatOpen(p => !p)} className="p-4 rounded-full bg-slate-600 hover:bg-slate-500">
                    <Icon name="message" className="w-8 h-8" />
                </button>
            </footer>
        </div>
    );
};

export default LiveRoomScreen;
