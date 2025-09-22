import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView, LiveAudioRoom, User, LiveAudioRoomMessage, ChatTheme } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { AGORA_APP_ID, CHAT_THEMES } from '../constants';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

const EMOJI_LIST = [
  // Hearts & Love
  '❤️', '🩷', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
  '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
  '💝', '💌', '🫶', '😍', '🥰', '😘', '😗', '😙', '😚',
  // Smileys & People
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😋', '😛', '😝', '😜', '🤪', '🤨', 
  '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', 
  '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', 
  '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', 
  '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', 
  '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', 
  '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', 
  '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', 
  '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', 
  '😼', '😽', '🙀', '😿', '😾',
  // Hands
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '🦾'
];

const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
const isJumboEmoji = (text: string | undefined): boolean => {
    if (!text) return false;
    const trimmedText = text.trim();
    const noEmojiText = trimmedText.replace(EMOJI_REGEX, '');
    if (noEmojiText.trim().length > 0) return false; 

    const graphemes = Array.from(trimmedText);
    return graphemes.length > 0 && graphemes.length <= 2;
};


interface LiveRoomScreenProps {
  currentUser: User;
  roomId: string;
  onNavigate: (view: AppView, props?: any) => void;
  onGoBack: () => void;
  onSetTtsMessage: (message: string) => void;
}

const Avatar: React.FC<{ user: User; isHost?: boolean; isSpeaking?: boolean; children?: React.ReactNode }> = ({ user, isHost, isSpeaking, children }) => (
    <div className="relative flex flex-col items-center gap-2 text-center w-24">
        <div className="relative">
            <img 
                src={user.avatarUrl}
                alt={user.name}
                className={`w-20 h-20 rounded-full border-4 transition-all duration-300 ${isSpeaking ? 'border-green-400 ring-4 ring-green-500/50 animate-pulse' : 'border-slate-600'}`}
            />
            {isHost && <div className="absolute -bottom-2 -right-1 text-2xl">👑</div>}
        </div>
        <p className="font-semibold text-slate-200 truncate w-full">{user.name}</p>
        {children}
    </div>
);

const HeartAnimation = () => (
    <div className="heart-animation-container">
        {Array.from({ length: 15 }).map((_, i) => (
            <div
                key={i}
                className="heart"
                style={{
                    left: `${Math.random() * 90 + 5}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    fontSize: `${Math.random() * 1.5 + 1.5}rem`,
                }}
            >
                ❤️
            </div>
        ))}
    </div>
);


const ChatMessage: React.FC<{ 
    message: LiveAudioRoomMessage; 
    activeSpeakerId: string | null; 
    isMe: boolean;
}> = ({ message, activeSpeakerId, isMe }) => {
    const [animate, setAnimate] = useState(true);

    useEffect(() => {
        setAnimate(true);
    }, [message.text]);

    const triggerAnimation = () => {
        setAnimate(false);
        setTimeout(() => setAnimate(true), 10);
    };

    const isSpeaking = message.sender.id === activeSpeakerId;
    const isJumbo = isJumboEmoji(message.text);
    
    const BUBBLE_COLORS = [
      'bg-sky-600', 'bg-emerald-600', 'bg-indigo-600',
      'bg-teal-600', 'bg-rose-600', 'bg-amber-600'
    ];
    
    const getUserColor = (userId: string) => {
      const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return BUBBLE_COLORS[hash % BUBBLE_COLORS.length];
    };


    const bubbleClasses = useMemo(() => {
        const base = 'px-4 py-2 rounded-2xl max-w-xs relative transition-all duration-300';
        if (isJumbo) {
            return `bg-transparent`;
        }
        if (isMe) {
            return `${base} bg-gradient-to-br from-blue-600 to-violet-600 text-white ml-auto rounded-br-none`;
        }
        
        const userColor = getUserColor(message.sender.id);
        const hostClass = message.isHost ? 'border border-amber-400/50' : '';
        return `${base} ${userColor} md:bg-slate-700 text-white rounded-bl-none ${hostClass}`;
    }, [isMe, message.isHost, isJumbo, message.sender.id]);

    const glowClass = isSpeaking ? 'shadow-[0_0_15px_rgba(57,255,20,0.7)]' : '';

    return (
        <div className={`w-full flex animate-fade-in-fast ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2 group max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                 {!isMe && <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-8 h-8 rounded-full mt-1 flex-shrink-0" />}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                        <div className="flex items-baseline gap-2 px-1">
                            <p className="text-sm font-bold text-slate-300">
                                {message.sender.name}
                                {message.isHost && <span className="ml-1.5" title="Host">👑</span>}
                            </p>
                        </div>
                    )}
                    <div className="relative">
                        <div className={`${bubbleClasses} ${glowClass}`}>
                           <p 
                             onClick={isJumbo ? triggerAnimation : undefined}
                             className={`text-base break-words overflow-wrap-break-word ${isJumbo ? 'jumbo-emoji' : ''} ${animate && isJumbo ? 'animate-jumbo-wiggle' : ''}`}>
                               {message.text}
                           </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BackgroundParticles: React.FC = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
            <div
                key={i}
                className="particle"
                style={{
                    '--size': `${Math.random() * 2 + 1}px`,
                    '--x-start': `${Math.random() * 100}vw`,
                    '--y-start': `${Math.random() * 100}vh`,
                    '--x-end': `${Math.random() * 100}vw`,
                    '--y-end': `${Math.random() * 100}vh`,
                    '--duration': `${Math.random() * 20 + 15}s`,
                    '--delay': `-${Math.random() * 20}s`,
                } as React.CSSProperties}
            />
        ))}
    </div>
);


const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ currentUser, roomId, onNavigate, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveAudioRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    
    const [messages, setMessages] = useState<LiveAudioRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [activeTheme, setActiveTheme] = useState(CHAT_THEMES.default);
    const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);

    const onGoBackRef = useRef(onGoBack);
    const onSetTtsMessageRef = useRef(onSetTtsMessage);

    useEffect(() => {
        onGoBackRef.current = onGoBack;
        onSetTtsMessageRef.current = onSetTtsMessage;
    });

    useEffect(() => {
        if (!AGORA_APP_ID) {
            onSetTtsMessageRef.current("Agora App ID is not configured. Real-time audio will not work.");
            console.error("Agora App ID is not configured in constants.ts");
            onGoBackRef.current();
            return;
        }

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        agoraClient.current = client;

        const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
            await client.subscribe(user, mediaType);
            if (mediaType === 'audio') {
                user.audioTrack?.play();
            }
        };

        const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {};
        const handleUserLeft = (user: IAgoraRTCRemoteUser) => {};

        const handleVolumeIndicator = (volumes: any[]) => {
            if (volumes.length === 0) {
                setActiveSpeakerId(null);
                return;
            };
            const mainSpeaker = volumes.reduce((max, current) => current.level > max.level ? current : max);
            if (mainSpeaker.level > 5) {
                setActiveSpeakerId(mainSpeaker.uid.toString());
            } else {
                setActiveSpeakerId(null);
            }
        };
        
        const setupAgora = async () => {
            client.on('user-published', handleUserPublished);
            client.on('user-unpublished', handleUserUnpublished);
            client.on('user-left', handleUserLeft);
            client.enableAudioVolumeIndicator();
            client.on('volume-indicator', handleVolumeIndicator);
            
            const uid = parseInt(currentUser.id, 36) % 10000000;
            
            const token = await geminiService.getAgoraToken(roomId, uid);
            if (!token) {
                console.error("Failed to retrieve Agora token. Cannot join room.");
                onSetTtsMessageRef.current("Could not join the room due to a connection issue.");
                onGoBackRef.current();
                return;
            }

            await client.join(AGORA_APP_ID, roomId, token, uid);
        };

        geminiService.joinLiveAudioRoom(currentUser.id, roomId).then(setupAgora);

        return () => {
            client.off('user-published', handleUserPublished);
            client.off('user-unpublished', handleUserUnpublished);
            client.off('user-left', handleUserLeft);
            client.off('volume-indicator', handleVolumeIndicator);

            if (localAudioTrack.current) {
                localAudioTrack.current.stop();
                localAudioTrack.current.close();
                localAudioTrack.current = null;
            }
            agoraClient.current?.leave();
            geminiService.leaveLiveAudioRoom(currentUser.id, roomId);
        };
    }, [roomId, currentUser.id]);
    
    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = geminiService.listenToAudioRoom(roomId, (roomDetails) => {
            if (roomDetails) {
                setRoom(roomDetails);
            } else {
                onSetTtsMessageRef.current("The room has ended.");
                onGoBackRef.current();
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [roomId]);

    useEffect(() => {
        const unsubscribe = geminiService.listenToLiveAudioRoomMessages(roomId, (newMessages) => {
            setMessages(newMessages);
        });
        return () => unsubscribe();
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (!room || !agoraClient.current) return;

        const amISpeakerNow = room.speakers.some(s => s.id === currentUser.id);
        const wasISpeakerBefore = !!localAudioTrack.current;

        const handleRoleChange = async () => {
            if (amISpeakerNow && !wasISpeakerBefore) {
                try {
                    const track = await AgoraRTC.createMicrophoneAudioTrack();
                    localAudioTrack.current = track;
                    await agoraClient.current?.publish(track);
                    track.setMuted(false);
                    setIsMuted(false);
                } catch (error) {
                    console.error("Error creating/publishing audio track:", error);
                    onSetTtsMessageRef.current("Could not activate microphone.");
                }
            }
            else if (!amISpeakerNow && wasISpeakerBefore) {
                try {
                    if (localAudioTrack.current) {
                        await agoraClient.current?.unpublish([localAudioTrack.current]);
                        localAudioTrack.current.stop();
                        localAudioTrack.current.close();
                        localAudioTrack.current = null;
                    }
                } catch (error) {
                    console.error("Error unpublishing audio track:", error);
                }
            }
        };

        handleRoleChange();

    }, [room, currentUser.id]);

    const handleLeave = () => onGoBack();
    
    const handleEndRoom = () => {
        if (window.confirm('Are you sure you want to end this room for everyone?')) {
            geminiService.endLiveAudioRoom(currentUser.id, roomId);
        }
    };
    
    const toggleMute = () => {
        if (localAudioTrack.current) {
            const willBeMuted = !isMuted;
            localAudioTrack.current.setMuted(willBeMuted);
            setIsMuted(willBeMuted);
        }
    };

    const handleRaiseHand = () => geminiService.raiseHandInAudioRoom(currentUser.id, roomId);
    const handleInviteToSpeak = (userId: string) => geminiService.inviteToSpeakInAudioRoom(currentUser.id, userId, roomId);
    const handleMoveToAudience = (userId: string) => geminiService.moveToAudienceInAudioRoom(currentUser.id, userId, roomId);

    const isHost = room?.host.id === currentUser.id;
    const isSpeaker = room?.speakers.some(s => s.id === currentUser.id) ?? false;
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        if (trimmedMessage === '' || !room) return;
        
        const isSingleHeart = Array.from(trimmedMessage).length === 1 && trimmedMessage.includes('❤️');
        if (isSingleHeart) {
            setShowHeartAnimation(true);
            setTimeout(() => setShowHeartAnimation(false), 3000);
        }

        try {
            await geminiService.sendLiveAudioRoomMessage(roomId, currentUser, trimmedMessage, !!isHost, isSpeaker);
            setNewMessage('');
            setEmojiPickerOpen(false);
        } catch (error) {
            console.error("Failed to send message:", error);
            onSetTtsMessage("Could not send message.");
        }
    };

    if (isLoading || !room) {
        return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">Loading Room...</div>;
    }
    
    const isListener = !isSpeaker;
    const hasRaisedHand = room.raisedHands.includes(currentUser.id);
    const raisedHandUsers = room.listeners.filter(u => room.raisedHands.includes(u.id));

    const speakerIdMap = new Map<string, string>();
    room.speakers.forEach(s => {
        const agoraUID = (parseInt(s.id, 36) % 10000000).toString();
        speakerIdMap.set(agoraUID, s.id);
    });

    const activeAppSpeakerId = activeSpeakerId ? speakerIdMap.get(activeSpeakerId) : null;

    return (
        <div className="h-full w-full flex flex-col md:flex-row bg-slate-900 text-white overflow-hidden">
             {showHeartAnimation && <HeartAnimation />}
             <style>{`
                @keyframes fade-in-fast {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-out forwards; }
                
                @keyframes particle-anim {
                    from { transform: translate3d(var(--x-start), var(--y-start), 0); opacity: 1; }
                    to { transform: translate3d(var(--x-end), var(--y-end), 0); opacity: 0; }
                }
                .particle {
                    position: absolute;
                    background: white;
                    border-radius: 50%;
                    width: var(--size);
                    height: var(--size);
                    opacity: 0;
                    animation: particle-anim var(--duration) var(--delay) linear infinite;
                }
             `}</style>
            <div className="h-3/5 md:h-full flex-shrink-0 md:flex-grow flex flex-col overflow-hidden">
                <header className="flex-shrink-0 p-4 flex justify-between items-center bg-black/20">
                    <div>
                        <h1 className="text-xl font-bold truncate">{room.topic}</h1>
                        <p className="text-sm text-slate-400">with {room.host.name}</p>
                    </div>
                    <button onClick={handleLeave} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-4 rounded-lg">
                        Leave
                    </button>
                </header>
                
                <main className="flex-grow overflow-y-auto p-6 space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-slate-300 mb-4">Speakers ({room.speakers.length})</h2>
                        <div className="flex flex-wrap gap-6">
                            {room.speakers.map(speaker => (
                                <Avatar key={speaker.id} user={speaker} isHost={speaker.id === room.host.id} isSpeaking={speaker.id === activeAppSpeakerId}>
                                    {isHost && speaker.id !== currentUser.id && (
                                        <button onClick={() => handleMoveToAudience(speaker.id)} className="text-xs text-red-400 hover:underline">Move to Audience</button>
                                    )}
                                </Avatar>
                            ))}
                        </div>
                    </section>

                    {isHost && raisedHandUsers.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-green-400 mb-4">Requests to Speak ({raisedHandUsers.length})</h2>
                            <div className="flex flex-wrap gap-6 bg-slate-800/50 p-4 rounded-lg">
                            {raisedHandUsers.map(user => (
                                    <Avatar key={user.id} user={user}>
                                        <button onClick={() => handleInviteToSpeak(user.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded-md font-semibold">Invite to Speak</button>
                                    </Avatar>
                            ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h2 className="text-lg font-semibold text-slate-300 mb-4">Listeners ({room.listeners.length})</h2>
                        <div className="flex flex-wrap gap-4">
                            {room.listeners.map(listener => (
                                <div key={listener.id} className="relative" title={listener.name}>
                                    <img src={listener.avatarUrl} alt={listener.name} className="w-12 h-12 rounded-full" />
                                    {room.raisedHands.includes(listener.id) && (
                                        <div className="absolute -bottom-1 -right-1 text-xl bg-slate-700 p-0.5 rounded-full">✋</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
                
                <footer className="relative flex-shrink-0 p-4 bg-black/20 flex justify-center items-center h-24 gap-4">
                    {isHost && <button onClick={handleEndRoom} className="bg-red-700 hover:bg-red-600 font-bold py-3 px-6 rounded-lg text-lg">End Room</button>}
                    {isSpeaker && (
                        <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                            <Icon name={isMuted ? 'microphone-slash' : 'mic'} className="w-6 h-6" />
                        </button>
                    )}
                    {isListener && (
                        <button onClick={handleRaiseHand} disabled={hasRaisedHand} className="bg-lime-600 hover:bg-lime-500 font-bold py-3 px-6 rounded-lg text-lg disabled:bg-slate-500 disabled:cursor-not-allowed text-black">
                            {hasRaisedHand ? 'Hand Raised ✋' : 'Raise Hand ✋'}
                        </button>
                    )}
                </footer>
            </div>
            
            <aside className={`flex-grow md:flex-grow-0 md:w-80 lg:w-96 md:h-full flex-shrink-0 bg-gradient-to-br ${activeTheme.bgGradient} backdrop-blur-sm flex flex-col border-t-2 md:border-t-0 md:border-l-2 border-slate-700/50`}>
                 <BackgroundParticles />
                 <header className="p-4 flex-shrink-0 border-b border-white/10 flex justify-between items-center z-10">
                    <h2 className="font-bold text-lg">Room Chat</h2>
                </header>
                <div className="relative flex-grow p-4 overflow-y-auto space-y-4 z-10">
                    {messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} activeSpeakerId={activeAppSpeakerId} isMe={msg.sender.id === currentUser.id} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <footer className="relative p-3 flex-shrink-0 border-t border-white/10 bg-black/20 z-10">
                     {isEmojiPickerOpen && (
                        <div className="absolute bottom-full left-0 right-0 p-2 bg-slate-900/95 backdrop-blur-sm rounded-t-lg border-t border-x border-slate-700 h-64 overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-8 gap-2">
                                {EMOJI_LIST.map(emoji => (
                                    <button key={emoji} type="button" onClick={() => setNewMessage(prev => prev + emoji)} className="text-2xl p-1 rounded-md hover:bg-slate-700/50 transition-colors">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <button type="button" onClick={() => setEmojiPickerOpen(p => !p)} className="p-2 rounded-full text-slate-300 hover:bg-slate-700/50">
                            <Icon name="face-smile" className="w-6 h-6"/>
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onFocus={() => setEmojiPickerOpen(false)}
                            placeholder="Send a message..."
                            className="w-full bg-slate-800/70 border border-slate-600 rounded-full py-2 px-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
                        />
                        <button type="submit" className="p-2.5 bg-lime-600 rounded-full text-black hover:bg-lime-500 transition-colors disabled:bg-slate-500" disabled={!newMessage.trim()}>
                            <Icon name="paper-airplane" className="w-5 h-5" />
                        </button>
                    </form>
                </footer>
            </aside>
        </div>
    );
};

export default LiveRoomScreen;