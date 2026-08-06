export type Post = {
  id: string;
  user_id: string;
  type: "text" | "code" | "media" | "note" | "repost";
  content: string;
  background?: string;
  code_lang?: string;
  media_url?: string;
  media_type?: "image" | "video";
  shared_post_id?: string;
  original_post?: Post | null;
  created_at: string;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  isRepostedByMe?: boolean;
  savedCollectionIds?: string[];
  archived?: boolean;
  profiles: {
    name: string;
    avatar_url: string;
    headline: string;
    username?: string;
  };
};

export type CommentResult = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_comment_id?: string | null;
  likeCount?: number;
  isLikedByMe?: boolean;
  replies?: CommentResult[];
  profiles: {
    name: string;
    avatar_url: string;
    username?: string;
  };
};

export type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  media_url?: string;
  media_type?: "image" | "video" | "document" | "audio" | "contact_share" | "poll" | string;
  reply_to_id?: string;
  deleted?: boolean;
  created_at: string;
};

export type UserProfile = {
  id: string;
  name: string;
  username?: string;
  avatar_url?: string;
  headline?: string;
  email?: string;
  resume_url?: string;
  created_at?: string;
  is_admin?: boolean;
  is_banned?: boolean;
  postCount?: number;
  followerCount?: number;
};

export type ContentReport = {
  id: string;
  reporter_id: string;
  target_id: string;
  target_type: "post" | "comment" | "user";
  reason: string;
  status: "pending" | "dismissed" | "reviewed";
  created_at: string;
  reporter?: {
    name: string;
    username?: string;
    avatar_url?: string;
  };
  contentPreview?: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tech_stack: string[];
  github_url?: string;
  live_url?: string;
  image_url?: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
    username?: string;
  };
};

export type JobListing = {
  id: string;
  posted_by: string;
  title: string;
  company: string;
  location?: string;
  job_type: "Full-time" | "Part-time" | "Internship" | "Contract";
  work_mode: "Remote" | "Onsite" | "Hybrid";
  description: string;
  requirements?: string;
  apply_url?: string;
  apply_email?: string;
  tags?: string[];
  expires_at?: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
    username?: string;
  };
  applicantCount?: number;
  hasApplied?: boolean;
};

export type JobApplication = {
  id: string;
  job_id: string;
  applicant_id: string;
  message?: string;
  created_at: string;
  applicant?: {
    name: string;
    avatar_url?: string;
    username?: string;
    headline?: string;
  };
};

export type Group = {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  is_private: boolean;
  topic_tags?: string[];
  created_by: string;
  created_at: string;
  memberCount?: number;
  isMember?: boolean;
  myRole?: "admin" | "moderator" | "member";
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  created_at: string;
  profile?: {
    name: string;
    username?: string;
    avatar_url?: string;
    headline?: string;
  };
};

export type GroupPost = {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: "image" | "video";
  type: "text" | "media" | "code";
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
    username?: string;
  };
};


