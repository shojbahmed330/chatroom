import React, { useState, useEffect, useRef } from 'react';
import { AppView, LiveAudioRoom, User, LiveAudioRoomMessage } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';

const EMOJI_LIST = [
  '❤️', '😂', '👍', '😢', '😡', '🔥', '😊', '😮', '👏', '🎉'
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
}> = ({ message }) => {
    const isJumbo = isJumboEmoji(message.text);
    
    return (
        <div className="flex items-start gap-2 group max-w-[85%] animate-fade-in-fast">
            <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-8 h-8 rounded-full mt-1 flex-shrink-0" />
            <div className="flex flex-col items-start">
                <div className="flex items-baseline gap-2 px-1">
                    <p className="text-sm font-bold text-slate-300 flex items-center">
                        {message.sender.name}
                        {message.isHost && <span className="ml-1.5" title="Host">👑</span>}
                    </p>
                </div>
                <div className={`px-4 py-2 rounded-2xl max-w-xs relative transition-all duration-300 ${isJumbo ? 'bg-transparent' : 'bg-slate-800/80'}`}>
                    <p className={`text-base break-words overflow-wrap-break-word ${isJumbo ? 'jumbo-emoji' : ''}`}>
                        {message.text}
                    </p>
                </div>
            </div>
        </div>
    );
};


const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({ currentUser, roomId, onGoBack, onSetTtsMessage }) => {
    const [room, setRoom] = useState<LiveAudioRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
    
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

    const handleLeave = () => onGoBack();
    
    const isHost = room?.host.id === currentUser.id;
    const isSpeaker = room?.speakers.some(s => s.id === currentUser.id) ?? false;
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        if (trimmedMessage === '' || !room) return;
        
        if (trimmedMessage === '❤️') {
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

    const ChatInterface = () => (
        <>
            <main className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
                 <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                    at the age of 18 or older. Rooms are monitored 24/7 to ensure compliance with our policies. Please follow the imo Community Guidelines to help build a safe and friendly community.
                </div>
                {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </main>
            <footer className="flex-shrink-0 p-2 bg-black flex items-center gap-2 z-10">
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
        </>
    );

    return (
    <div className="h-full w-full flex flex-col bg-black text-white overflow-hidden">
        {showHeartAnimation && <HeartAnimation />}

        <header className="flex-shrink-0 p-3 flex justify-between items-center bg-black/50 backdrop-blur-sm z-20">
            <div className="flex items-center gap-2">
                <img src="https://i.pravatar.cc/150?u=unmad" alt="Unmad" className="w-10 h-10 rounded-full" />
                <div>
                    <h1 className="font-bold text-white">Unmad</h1>
                    <p className="text-xs text-slate-400">Members: 252</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={handleLeave}><Icon name="close" className="w-6 h-6" /></button>
            </div>
        </header>
        
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* Main content area for users */}
            <div className="flex-grow flex flex-col overflow-y-auto no-scrollbar">
                {/* Mobile-only fixed speaker/listener grid */}
                <div className="flex-shrink-0 p-4 space-y-4 md:hidden">
                    <div>
                        <h2 className="text-sm font-bold text-slate-400 mb-2">Speakers</h2>
                        <div className="grid grid-cols-5 gap-2">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={`speaker-${i}`} className="w-16 h-16 bg-slate-700 rounded-full"></div>
                            ))}
                        </div>
                    </div>
                     <div>
                        <h2 className="text-sm font-bold text-slate-400 mb-2">Listeners</h2>
                        <div className="grid grid-cols-8 gap-2">
                            {Array.from({ length: 16 }).map((_, i) => (
                                <div key={`listener-${i}`} className="w-10 h-10 bg-slate-700 rounded-full"></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Desktop user grid & Mobile chat log */}
                <div className="flex-grow overflow-y-auto no-scrollbar">
                    {/* Desktop: Show all users in a grid */}
                    <div className="hidden md:flex flex-wrap gap-x-2 gap-y-4 justify-center p-4">
                        {room.speakers.map(speaker => (
                            <Avatar key={speaker.id} user={speaker} isHost={speaker.id === room.host.id} isSpeaking={speaker.id === activeSpeakerId} />
                        ))}
                        {room.listeners.map(listener => (
                            <Avatar key={listener.id} user={listener} />
                        ))}
                    </div>
                     {/* Mobile: Show chat messages here */}
                    <div className="md:hidden flex flex-col h-full">
                        <ChatInterface />
                    </div>
                </div>
            </div>

             {/* Desktop-only chat sidebar */}
            <aside className="w-96 flex-shrink-0 bg-slate-900/50 border-l border-slate-700 flex-col hidden md:flex">
                <ChatInterface />
            </aside>
        </div>
    </div>
    );
};

export default LiveRoomScreen;