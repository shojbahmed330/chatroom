

export interface User {
  id: string;
  name: string; // Full Name
  username: string; // Unique, no spaces
  name_lowercase: string; // For case-insensitive queries
  email: string;
  password?: string; // For mock verification
  avatarUrl: string;
  bio: string;
  friendshipStatus?: FriendshipStatus;
  
  // New profile fields
  coverPhotoUrl: string;
  work?: string;
  createdAt: string; // ISO 8601 string for registration date

  education?: string;
  hometown?: string;
  currentCity?: string;
  relationshipStatus?: 'Single' | 'In a relationship' | 'Engaged' | 'Married' | "It's complicated" | 'Prefer not to say';
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  age?: number;

  // New privacy settings
  privacySettings: {
    postVisibility: 'public' | 'friends';
    friendRequestPrivacy: 'everyone' | 'friends_of_friends';
    friendListVisibility?: 'public' | 'friends' | 'only_me';
  };
  notificationSettings?: {
    likes?: boolean;
    comments?: boolean;
    friendRequests?: boolean;
    campaignUpdates?: boolean;
    groupPosts?: boolean;
  };
  blockedUserIds: string[];
  chatSettings?: {
    [peerId: string]: Partial<ChatSettings>;
  };

  // Monetization
  voiceCoins?: number;

  // App roles
  role?: 'user' | 'admin';

  // Admin moderation fields
  isBanned?: boolean;
  commentingSuspendedUntil?: string; // ISO 8601 string
  postingSuspendedUntil?: string; // ISO 8601 string
  isDeactivated?: boolean;
  lastActiveTimestamp?: string; // ISO 8601 string for last seen timestamp
  
  // Friends list
  onlineStatus?: 'online' | 'offline';
  friendIds?: string[];
}

export interface Author {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  privacySettings?: {
    postVisibility: 'public' | 'friends';
    friendRequestPrivacy: 'everyone' | 'friends_of_friends';
  };
}

export interface AdminUser {
    id: string;
    email: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedContentId: string; // can be postId, commentId, or userId
  reportedContentType: 'post' | 'comment' | 'user';
  reportedUserId: string; // ID of the user who created the content or was reported
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: string; // ISO string
  resolution?: string; // e.g. "Content Deleted", "User Banned", "Dismissed"
  resolvedAt?: string; // ISO string
}

export interface PollOption {
  text: string;
  votes: number;
  votedBy: string[]; // Array of user IDs
}

export interface Post {
  id: string;
  author: Author;
  audioUrl?: string;
  caption: string;
  captionStyle?: {
    fontFamily: string; // Corresponds to a name in REEL_TEXT_FONTS
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  };
  duration: number; // in seconds
  createdAt: string; // ISO 8601 string
  commentCount: number;
  comments: Comment[];
  reactions?: { [userId: string]: string }; // Map of userId to emoji string
  reactionCount?: number; // This can be deprecated if we calculate on client, but keeping for now.
  imageUrl?: string;
  imagePrompt?: string;
  videoUrl?: string;
  postType?: 'profile_picture_change' | 'cover_photo_change' | 'question' | 'announcement';
  newPhotoUrl?: string;
  // Monetization
  isSponsored?: boolean;
  sponsorName?: string;
  campaignId?: string;
  websiteUrl?: string;
  allowDirectMessage?: boolean;
  allowLeadForm?: boolean;
  sponsorId?: string;

  // Groups
  groupId?: string;
  groupName?: string;
  status?: 'approved' | 'pending';

  // New Poll Feature
  poll?: {
    question: string;
    options: PollOption[];
  }
  
  // New Q&A Feature
  bestAnswerId?: string;

  // New Feeling/Activity Feature
  feeling?: {
    emoji: string;
    text: string;
  };
}

export interface Comment {
    id: string;
    postId: string;
    author: Author;
    createdAt: string;
    updatedAt?: string;
    type: 'audio' | 'text' | 'image';
    audioUrl?: string;
    duration?: number;
    text?: string;
    imageUrl?: string;
    reactions?: { [userId: string]: string };
    parentId?: string | null;
    isDeleted?: boolean;
}

export interface ReplyInfo {
    messageId: string;
    senderName: string;
    content: string; // "Voice Message · 5s", "Image", or text snippet
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'audio' | 'text' | 'image' | 'video';
  text?: string;
  audioUrl?: string;
  mediaUrl?: string;
  duration?: number; // for audio/video
  createdAt: string;
  read: boolean;
  reactions?: { [emoji: string]: string[] }; // Key: emoji, Value: array of user IDs
  replyTo?: ReplyInfo;
  isDeleted?: boolean;
}

export interface Conversation {
  peer: User;
  lastMessage: Message;
  unreadCount: number;
}

export type NotificationType = 'like' | 'comment' | 'friend_request' | 'friend_request_approved' | 'campaign_approved' | 'campaign_rejected' | 'group_post' | 'group_join_request' | 'group_request_approved' | 'admin_announcement' | 'admin_warning';

export interface Notification {
  id: string;
  type: NotificationType;
  user: User; // User who initiated the notification (or system/admin)
  post?: Post; // Relevant post for likes/comments
  createdAt: string; // ISO 8601 string
  read: boolean;
  campaignName?: string;
  rejectionReason?: string;
  groupId?: string;
  groupName?: string;
  message?: string; // For announcements and warnings
}

export type ChatTheme = 'default' | 'sunset' | 'ocean' | 'forest' | 'classic';

export interface ChatSettings {
  theme: ChatTheme;
  // Future settings
  // sound?: string;
  // notifications?: 'on' | 'off';
}

export interface Campaign {
  id:string;
  sponsorId: string;
  sponsorName: string;
  caption: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  budget: number; // in BDT
  views: number;
  clicks: number;
  websiteUrl?: string;
  allowDirectMessage?: boolean;
  allowLeadForm?: boolean;
  status: 'pending' | 'active' | 'finished' | 'rejected';
  transactionId?: string;
  paymentStatus?: 'pending' | 'verified' | 'failed';
  paymentVerifiedBy?: string; // Admin ID
  paymentVerifiedAt?: string; // ISO string
  createdAt: string; // ISO string
  // New advanced features
  adType: 'feed' | 'story';
  targeting?: {
    location?: string;
    gender?: 'Male' | 'Female' | 'All';
    ageRange?: string; // e.g., "18-25", "26-35"
    interests?: string[];
  };
}

export interface LiveAudioRoom {
  id: string;
  host: User;
  topic: string;
  speakers: User[];
  listeners: User[];
  raisedHands: string[]; // Array of user IDs
  createdAt: string;
  status: 'live' | 'ended';
}

export interface LiveAudioRoomMessage {
  id: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  text: string;
  createdAt: string; // ISO string
  isHost?: boolean;
  isSpeaker?: boolean;
  reactions?: { [emoji: string]: string[] }; // Key: emoji, Value: array of user IDs
}

export interface VideoParticipantState extends User {
    isMuted?: boolean;
    isCameraOff?: boolean;
}

export interface LiveVideoRoom {
    id: string;
    host: User;
    topic: string;
    participants: VideoParticipantState[];
    createdAt: string;
    status: 'live' | 'ended';
}

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description: string;
  date: string; // ISO 8601
  creator: User;
  attendees: User[];
}

export interface GroupChatMessage {
    id: string;
    sender: User;
    text: string;
    createdAt: string;
}

export interface GroupChat {
    groupId: string;
    messages: GroupChatMessage[];
}

export type GroupCategory = 'General' | 'Food' | 'Gaming' | 'Music' | 'Technology' | 'Travel' | 'Art & Culture' | 'Sports';

export type GroupRole = 'Admin' | 'Moderator' | 'Top Contributor';

export interface JoinRequest {
    user: User;
    answers?: string[];
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverPhotoUrl: string;
  creator: User;
  members: User[];
  memberCount: number;
  createdAt: string;
  // Group discovery
  category: GroupCategory;
  // Group moderation features
  privacy: 'public' | 'private';
  admins: User[];
  moderators: User[];
  requiresApproval: boolean; // Does this group require posts to be approved?
  joinRequests?: JoinRequest[];
  pendingPosts?: Post[];
  joinQuestions?: string[];
  invitedUserIds?: string[];
  topContributorIds?: string[];
  // New engagement features
  pinnedPostId?: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  language: 'bangla' | 'hindi';
}

export interface StoryTextStyle {
    name: string;
    backgroundColor: string;
    fontFamily: string;
    color: string;
    textAlign: 'left' | 'center' | 'right';
}

export type StoryPrivacy = 'public' | 'friends';

export interface Story {
    id: string;
    author: User;
    createdAt: string; // ISO string
    type: 'video' | 'image' | 'voice' | 'text';
    contentUrl?: string; // For video, image, voice
    duration: number; // in seconds
    text?: string;
    textStyle?: StoryTextStyle;
    music?: MusicTrack;
    viewedBy: string[]; // Array of user IDs who have viewed it
    privacy: StoryPrivacy;

    // Sponsorship
    isSponsored?: boolean;
    sponsorName?: string;
    sponsorAvatar?: string;
    campaignId?: string;
    ctaLink?: string;
}

export interface CategorizedExploreFeed {
    trending: Post[];
    forYou: Post[];
    questions: Post[];
    funnyVoiceNotes: Post[];
    newTalent: Post[];
}

export interface Lead {
  id: string;
  campaignId: string;
  sponsorId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  createdAt: string; // ISO string
}

export interface Call {
  id: string;
  caller: Author;
  callee: Author;
  chatId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'rejected' | 'ended' | 'missed' | 'declined';
  createdAt: string; // ISO string
  endedAt?: string; // ISO string
}


export enum AppView {
  AUTH,
  FEED,
  PROFILE,
  SETTINGS,
  CREATE_POST,
  CREATE_COMMENT,
  SEARCH_RESULTS,
  FRIEND_REQUESTS, 
  POST_DETAILS,
  FRIENDS,
  CONVERSATIONS,
  ADS_CENTER,
  ROOMS_HUB,
  ROOMS_LIST,
  LIVE_ROOM,
  VIDEO_ROOMS_LIST,
  LIVE_VIDEO_ROOM,
  GROUPS_HUB,
  GROUP_PAGE,
  MANAGE_GROUP,
  GROUP_CHAT,
  GROUP_EVENTS,
  CREATE_EVENT,
  CREATE_STORY,
  STORY_VIEWER,
  STORY_PRIVACY,
  EXPLORE,
  REELS,
  CREATE_REEL,
  MOBILE_MENU,
  GROUP_INVITE,
  CALL_SCREEN,
}

export enum RecordingState {
    IDLE,
    RECORDING,
    PREVIEW,
    UPLOADING,
    POSTED,
}

export enum AuthMode {
    LOGIN,
    SIGNUP_FULLNAME,
    SIGNUP_USERNAME,
    SIGNUP_EMAIL,
    SIGNUP_PASSWORD,
    SIGNUP_CONFIRM_PASSWORD,
    SIGNUP_VERIFY_CODE,
}

export enum VoiceState {
    IDLE,
    LISTENING,
    PROCESSING
}

export enum FriendshipStatus {
    NOT_FRIENDS,
    FRIENDS,
    REQUEST_SENT,
    PENDING_APPROVAL,
}

// NLU Intent Types from Gemini
export type Intent = 
  | 'intent_signup' | 'intent_login' | 'intent_play_post' | 'intent_pause_post'
  | 'intent_next_post' | 'intent_previous_post' | 'intent_create_post' | 'intent_create_voice_post' | 'intent_stop_recording'
  | 'intent_post_confirm' | 'intent_re_record' | 'intent_comment' | 'intent_post_comment'
  | 'intent_search_user' | 'intent_select_result' | 'intent_like' | 'intent_share'
  | 'intent_open_profile' | 'intent_change_avatar' | 'intent_help' | 'unknown' | 'intent_go_back'
  | 'intent_open_settings' | 'intent_add_friend' | 'intent_send_message'
  | 'intent_save_settings'
  | 'intent_update_profile' // extracts 'field' ('name', 'bio', 'work' etc) and 'value'.
  | 'intent_update_privacy' // extracts 'setting' ('postVisibility' etc) and 'value' ('friends' etc).
  | 'intent_update_notification_setting' // extracts 'setting' ('likes', 'comments', etc.) and 'value' ('on' or 'off')
  | 'intent_block_user' // extracts 'target_name'
  | 'intent_unblock_user' // extracts 'target_name'
  | 'intent_edit_profile'
  | 'intent_record_message' | 'intent_send_chat_message' | 'intent_view_comments'
  | 'intent_send_text_message_with_content' // Used for dictating a text message
  | 'intent_open_friend_requests' | 'intent_accept_request' | 'intent_decline_request'
  | 'intent_scroll_up' | 'intent_scroll_down'
  | 'intent_stop_scroll'
  | 'intent_open_messages'
  | 'intent_open_friends_page'
  | 'intent_open_chat' // extracts 'target_name'
  | 'intent_change_chat_theme' // extracts 'theme_name'
  | 'intent_delete_chat'
  | 'intent_send_voice_emoji' // extracts 'emoji_type' (e.g., 'laughing', 'heart', 'sad')
  | 'intent_play_comment_by_author' // extracts 'target_name'
  | 'intent_view_comments_by_author' // extracts 'target_name'
  | 'intent_generate_image' // extracts 'prompt'
  | 'intent_clear_image'
  | 'intent_claim_reward' // For rewarded ads
  // Ads Center Intents
  | 'intent_open_ads_center'
  | 'intent_create_campaign'
  | 'intent_view_campaign_dashboard'
  | 'intent_set_sponsor_name' // extracts 'sponsor_name'
  | 'intent_set_campaign_caption' // extracts 'caption_text'
  | 'intent_set_campaign_budget' // extracts 'budget_amount'
  | 'intent_set_media_type' // extracts 'media_type' ('image', 'video', 'audio')
  | 'intent_launch_campaign'
  | 'intent_change_password'
  | 'intent_deactivate_account'
  | 'intent_open_feed'
  | 'intent_open_explore' // New intent for explore feed
  // Room Navigation
  | 'intent_open_rooms_hub'
  | 'intent_open_audio_rooms'
  | 'intent_open_video_rooms'
  | 'intent_create_room'
  | 'intent_close_room'
  // General Actions
  | 'intent_reload_page'
  // Groups
  | 'intent_open_groups_hub'
  | 'intent_join_group' // extracts 'group_name'
  | 'intent_leave_group' // extracts 'group_name'
  | 'intent_create_group' // extracts 'group_name'
  | 'intent_search_group' // extracts 'search_query'
  | 'intent_filter_groups_by_category' // extracts 'category_name'
  | 'intent_invite_to_group' // extracts 'target_name'
  | 'intent_view_group_suggestions'
  // New Group Engagement Intents
  | 'intent_pin_post'
  | 'intent_unpin_post'
  | 'intent_open_group_chat'
  | 'intent_open_group_events'
  | 'intent_create_event'
  | 'intent_create_poll'
  | 'intent_vote_poll' // extracts 'option_number' or 'option_text'
  | 'intent_view_group_by_name' // extracts 'group_name'
  | 'intent_manage_group'
  | 'intent_open_group_invite_page'
  // Story Intents
  | 'intent_create_story'
  | 'intent_add_music'
  | 'intent_post_story'
  | 'intent_set_story_privacy'
  | 'intent_add_text_to_story'
  // Message Screen Actions
  | 'intent_react_to_message' // extracts 'emoji_type'
  | 'intent_reply_to_message'
  | 'intent_reply_to_last_message' // extracts 'message_content'
  | 'intent_react_to_last_message' // extracts 'emoji_type'
  | 'intent_unsend_message'
  | 'intent_send_announcement' // extracts 'message_content'
  // New Friendship Intents
  | 'intent_unfriend_user' // extracts 'target_name'
  | 'intent_cancel_friend_request'; // extracts 'target_name'


export interface NLUResponse {
  intent: Intent;
  slots?: {
    [key:string]: string | number;
  };
}

export type ScrollState = 'up' | 'down' | 'none';