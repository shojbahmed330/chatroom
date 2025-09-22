import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveAudioRoom, User, AppView, LiveAudioRoomMessage } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { AGORA_APP_ID } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

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
    onClick?: () => void;
    size?: 'small' | 'large';
}> = ({ participant, isHost, isMuted, isSpeaking, onClick, size = 'large' }) => {
    const cardSize = size === 'large' ? 'w-20 h-20' : 'w-16 h-16';
    const wrapperSize = size === 'large' ? 'w-24' : 'w-20';

    return (
        <div className={`flex flex-col items-center text-center relative ${wrapperSize}`} onClick={onClick}>
            <div className={`relative rounded-full p-1 transition-all duration-300 ${isSpeaking ? 'bg-green-500/50 speaking-glow' : 'bg-transparent'}`}>
                <img src={participant.avatarUrl} alt={participant.name} className={`${cardSize} rounded-full`} />
                {isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-slate-700 p-1.5 rounded-full border-2 border-slate-900">
                        <Icon name="microphone-slash" className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>
            <p className={`mt-2 font-semibold text-slate-100 truncate ${wrapperSize}`}>{participant.name}</p>
            {isHost && <p className="text-xs text-amber-400">Host</p>}
        </div>
    );
}

const ChatInterface: React.FC<{
    messages: LiveAudioRoomMessage[];
    onSendMessage: (e: React.FormEvent) => void;
    newMessage: string;
    setNewMessage: (msg: string) => void;
}> = ({ messages, onSendMessage, newMessage, setNewMessage }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="h-full bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-2xl flex flex-col">
            <div className="flex-grow p-3 overflow-y-auto space-y-3 no-scrollbar">
                {messages.map(msg => (
                    <div key={msg.id} className="flex items-start gap-2">
                       <img src={msg.sender.avatarUrl} alt={msg.sender.name} className="w-8 h-8 rounded-full"/>
                       <div>
                           <p className="text-xs">
                                <span className="font-bold text-lime-300">{msg.sender.name}</span> 
                                <span className="text-slate-400 ml-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </p>
                           <p className="text-sm bg-slate-700/50 px-2 py-1 rounded-md inline-block whitespace-pre-wrap break-words">{msg.text}</p>
                       </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={onSendMessage} className="p-2 border-t border-slate-700 flex-shrink-0 flex gap-2">
                 <input 
                    type="text" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Send a message..." 
                    className="flex-grow bg-slate-700 rounded-full px-3 py-1.5 text-sm border border-slate-600 focus:ring-lime-500 focus:border-lime-500"
                />
                 <button type="submit" className="bg-lime-600 text-black p-2 rounded-full disabled:bg-slate-500" disabled={!newMessage.trim()}>
                    <Icon name="paper-airplane" className="w-4 h-4"/>
                </button>
            </form>
        </div>
    );
};

const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage, onOpenProfile }) => {
    const [room, setRoom] = useState<LiveAudioRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
    const [messages, setMessages] = useState<LiveAudioRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

    const isHost = room?.host.id === currentUser.id;
    const isSpeaker = useMemo(() => room?.speakers.some(s => s.id === currentUser.id) ?? false, [room?.speakers, currentUser.id]);

    // Effect 1: Handles Agora client setup, join, and publish. Runs only ONCE.
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

                // Always join muted initially. Another effect will unmute if the user is a speaker.
                await localAudioTrack.current.setMuted(true);
                setIsMuted(true);
            } catch (error: any) {
                console.error("Agora join/publish error:", error);
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
    }, [roomId, currentUser.id, onGoBack, onSetTtsMessage]);
    
    // Effect 2: Listens to room data from Firestore
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = geminiService.listenToAudioRoom(roomId, (roomDetails) => {
            if (roomDetails) {
                setRoom(roomDetails);
            } else {
                onSetTtsMessage("This room has ended.");
                onGoBack();
            }
            setIsLoading(false);
        });
        return unsubscribe;
    }, [roomId, onGoBack, onSetTtsMessage]);

    // Effect 3: Manages local audio track mute state based on speaker status
    useEffect(() => {
        if (localAudioTrack.current) {
            localAudioTrack.current.setMuted(!isSpeaker);
            setIsMuted(!isSpeaker);
        }
    }, [isSpeaker]);

    // Effect 4: Listens for chat messages
    useEffect(() => {
        const unsubscribe = geminiService.listenToLiveAudioRoomMessages(roomId, setMessages);
        return unsubscribe;
    }, [roomId]);

    const toggleMute = () => {
        if (isSpeaker) {
            const newMutedState = !isMuted;
            localAudioTrack.current?.setMuted(newMutedState);
            setIsMuted(newMutedState);
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
        await geminiService.sendLiveAudioRoomMessage(roomId, currentUser, newMessage.trim(), isHost, isSpeaker);
        setNewMessage('');
    };

    if (isLoading || !room) {
        return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">Loading Room...</div>;
    }
    
    const hasRaisedHand = room.raisedHands.includes(currentUser.id);
    const sortedSpeakers = [...room.speakers].sort((a, b) => (a.id === room.host.id ? -1 : b.id === room.host.id ? 1 : 0));

    return (
        <div className="h-full w-full flex flex-col bg-gradient-to-b from-slate-900 to-black text-white overflow-hidden">
            <header className="flex-shrink-0 p-4 flex justify-between items-center bg-black/20">
                <div className="flex items-center gap-3">
                    <img src={room.host.avatarUrl} alt="Host" className="w-10 h-10 rounded-full" />
                    <div>
                        <h1 className="text-lg font-bold truncate">{room.topic}</h1>
                        <p className="text-xs text-slate-400">{room.speakers.length + room.listeners.length} people here</p>
                    </div>
                </div>
                <button onClick={handleLeave} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-4 rounded-lg">
                    {isHost ? 'End Room' : 'Leave Quietly'}
                </button>
            </header>

            <main className="flex-grow p-4 overflow-y-auto no-scrollbar relative">
                <div className={`transition-all duration-300 ${isChatOpen ? 'md:mr-[340px]' : 'md:mr-0'}`}>
                    <h2 className="text-lg font-bold text-lime-400 mb-4">Speakers ({room.speakers.length})</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-y-6 gap-x-4">
                        {sortedSpeakers.map(s => (
                            <ParticipantCard key={s.id} participant={s} isHost={s.id === room.host.id} isMuted={s.id === currentUser.id ? isMuted : true} isSpeaking={s.id === activeSpeakerId} onClick={() => isHost && s.id !== room.host.id ? handleMoveToAudience(s.id) : onOpenProfile(s.username)} />
                        ))}
                    </div>

                    <h2 className="text-lg font-bold text-lime-400 mt-8 mb-4">Listeners ({room.listeners.length})</h2>
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-y-6 gap-x-4">
                        {room.listeners.map(l => (
                             <ParticipantCard key={l.id} participant={l} isHost={false} isMuted={true} isSpeaking={false} onClick={() => isHost ? handleInviteToSpeak(l.id) : onOpenProfile(l.username)} />
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
                </div>
                 {/* Chat Panel - Desktop */}
                 <div className={`absolute top-0 right-0 w-80 h-full hidden md:block transition-transform duration-300 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <ChatInterface messages={messages} onSendMessage={handleSendMessage} newMessage={newMessage} setNewMessage={setNewMessage} />
                 </div>
            </main>
            
            {/* Chat Panel - Mobile */}
            <div className={`fixed bottom-24 left-4 right-4 h-[60%] bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-2xl flex flex-col transition-all duration-300 md:hidden ${isChatOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                 <ChatInterface messages={messages} onSendMessage={handleSendMessage} newMessage={newMessage} setNewMessage={setNewMessage} />
            </div>
            
            <footer className="flex-shrink-0 p-4 bg-black/30 flex justify-center items-center h-24 gap-6">
                 <button onClick={toggleMute} className={`w-16 h-16 flex items-center justify-center p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-slate-600' : 'bg-green-600'} ${hasRaisedHand ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}>
                    <Icon name={isMuted ? (isSpeaker ? 'microphone-slash' : 'mic') : 'mic'} className="w-8 h-8" />
                </button>
                 <button onClick={() => setIsChatOpen(p => !p)} className={`w-16 h-16 flex items-center justify-center p-4 rounded-full transition-colors ${isChatOpen ? 'bg-lime-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                    <Icon name="message" className="w-8 h-8" />
                </button>
            </footer>
        </div>
    );
};

export default LiveRoomScreen;