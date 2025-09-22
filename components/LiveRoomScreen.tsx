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

const Avatar: React.FC<{ user: User; isHost?: boolean; isSpeaking?: boolean; children?: React.ReactNode, specialIcon?: 'shield' | 'lock' | 'megaphone' | 'mute' }> = ({ user, isHost, isSpeaking, children, specialIcon }) => (
    <div className="relative flex flex-col items-center gap-1 text-center w-20">
        <div className="relative">
            <img 
                src={user.avatarUrl}
                alt={user.name}
                className={`w-16 h-16 rounded-full border-2 transition-all duration-300 ${isSpeaking ? 'speaking-glow border-blue-400' : 'border-slate-600'}`}
            />
            {specialIcon && (
                <div className="absolute -bottom-1 -right-1 bg-slate-700 p-1 rounded-full">
                    {specialIcon === 'shield' && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                    {specialIcon === 'megaphone' && <span className="text-xs">📢</span>}
                    {specialIcon === 'lock' && <Icon name="lock-closed" className="w-3 h-3 text-slate-300" />}
                    {specialIcon === 'mute' && <Icon name="microphone-slash" className="w-3 h-3 text-red-400" />}
                </div>
            )}
        </div>
        <div className="flex items-center gap-1">
             {isHost && <span title="Host">👑</span>}
            <p className="font-semibold text-slate-200 text-xs truncate w-16">{user.name}</p>
        </div>
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
    isMe: boolean;
}> = ({ message, isMe }) => {
    const [animate, setAnimate] = useState(true);

    useEffect(() => {
        setAnimate(true);
    }, [message.text]);

    const triggerAnimation = () => {
        setAnimate(false);
        setTimeout(() => setAnimate(true), 10);
    };

    const isJumbo = isJumboEmoji(message.text);
    
    return (
        <div className={`w-full flex animate-fade-in-fast ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2 group max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                 {!isMe && <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-8 h-8 rounded-full mt-1 flex-shrink-0" />}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                        <div className="flex items-baseline gap-2 px-1">
                            <p className="text-sm font-bold text-slate-300 flex items-center">
                                {message.sender.name}
                                {message.isHost && <span className="ml-1.5" title="Host">👑</span>}
                                 <span className="ml-1 text-xs text-blue-400">🛡️</span>
                                  <span className="ml-1 text-xs">📢</span>
                            </p>
                        </div>
                    )}
                    <div className="relative">
                         <div className={`px-4 py-2 rounded-2xl max-w-xs relative transition-all duration-300 ${isJumbo ? 'bg-transparent' : 'bg-slate-800/80'}`}>
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


const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ currentUser, roomId, onNavigate, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveAudioRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
    const [isMuted, setIsMuted] = useState(true); // Start muted by default
    
    const [messages, setMessages] = useState<LiveAudioRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);

    const onGoBackRef = useRef(onGoBack);
    const onSetTtsMessageRef = useRef(onSetTtsMessage);

    useEffect(() => {
        onGoBackRef.current = onGoBack;
        onSetTtsMessageRef.current = onSetTtsMessage;
    });

    useEffect(() => {
        // ... (agora setup remains the same)
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
        // ... (role change logic remains the same)
    }, [room, currentUser.id]);

    const handleLeave = () => onGoBack();
    
    const handleEndRoom = () => {
        if (window.confirm('Are you sure you want to end this room for everyone?')) {
            geminiService.endLiveAudioRoom(currentUser.id, roomId);
        }
    };
    
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
        } catch (error) {
            console.error("Failed to send message:", error);
            onSetTtsMessage("Could not send message.");
        }
    };

    if (isLoading || !room) {
        return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">Loading Room...</div>;
    }
    
    const allUsers = [...room.speakers, ...room.listeners];

    return (
    <div className="h-full w-full flex flex-col bg-black text-white overflow-hidden">
        {showHeartAnimation && <HeartAnimation />}

        {/* Header */}
        <header className="flex-shrink-0 p-3 flex justify-between items-center bg-black/50 backdrop-blur-sm z-20">
            <div className="flex items-center gap-2">
                <img src="https://i.pravatar.cc/150?u=unmad" alt="Unmad" className="w-10 h-10 rounded-full" />
                <div>
                    <h1 className="font-bold text-white">Unmad</h1>
                    <p className="text-xs text-slate-400">Members: 252</p>
                </div>
                <button className="w-7 h-7 bg-blue-500 rounded-full text-white text-xl font-bold flex items-center justify-center">+</button>
            </div>
            <div className="flex items-center gap-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                <button onClick={handleLeave}><Icon name="close" className="w-6 h-6" /></button>
            </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* User Grid */}
            <div className="flex flex-wrap gap-x-2 gap-y-4 justify-center">
                 {room.speakers.map(speaker => (
                    <Avatar key={speaker.id} user={speaker} isHost={speaker.id === room.host.id} isSpeaking={speaker.id === activeSpeakerId} specialIcon={speaker.id === room.host.id ? 'shield' : 'megaphone'} />
                ))}
                 <Avatar user={{id: '2', name: 'Farzan...', avatarUrl: 'https://i.pravatar.cc/150?u=farzan'} as User} specialIcon="megaphone" />
                 <Avatar user={{id: '3', name: 'আরাফাত', avatarUrl: 'https://i.pravatar.cc/150?u=arafat'} as User} specialIcon="shield" />
                 <Avatar user={{id: '4', name: 'Necessary', avatarUrl: 'https://i.pravatar.cc/150?u=necessary'} as User} specialIcon="shield" />
                 <Avatar user={{id: '5', name: 'Khusb...', avatarUrl: 'https://i.pravatar.cc/150?u=khusb'} as User} specialIcon="mute" />
                 <Avatar user={{id: '6', name: 'চল হাট', avatarUrl: 'https://i.pravatar.cc/150?u=chothat'} as User} />
                 <Avatar user={{id: '7', name: 'speech...', avatarUrl: 'https://i.pravatar.cc/150?u=speech'} as User} specialIcon="mute" />
                 <Avatar user={{id: '8', name: 'Shakib', avatarUrl: 'https://i.pravatar.cc/150?u=shakib'} as User} isSpeaking={true} />
                  {room.listeners.map(listener => (
                    <Avatar key={listener.id} user={listener} />
                ))}
            </div>

            {/* Guidelines */}
            <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                at the age of 18 or older. Rooms are monitored 24/7 to ensure compliance with our policies. Please follow the imo Community Guidelines to help build a safe and friendly community. Users or rooms sharing pornographic, violent, or other inappropriate content will face strict penalties. To protect yourself from fraud, be careful with any financial transactions.
            </div>

            {/* Chat Messages */}
            <div className="space-y-4">
                {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} isMe={msg.sender.id === currentUser.id} />
                ))}
                <div ref={messagesEndRef} />
            </div>
        </main>
        
        <footer className="flex-shrink-0 p-2 bg-black flex items-center gap-2 z-10">
            <div className="footer-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <form onSubmit={handleSendMessage} className="relative flex-grow">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Say Hi..."
                    className="w-full bg-[#3a3b3c] border-none rounded-full py-2 pl-4 pr-10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500 text-sm"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                     <Icon name="face-smile" className="w-5 h-5"/>
                </button>
            </form>
        </footer>
    </div>
    );
};

export default LiveRoomScreen;