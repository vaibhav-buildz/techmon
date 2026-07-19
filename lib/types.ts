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
  profiles: {
    name: string;
    avatar_url: string;
    headline: string;
  };
};

export type CommentResult = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    avatar_url: string;
  };
};
