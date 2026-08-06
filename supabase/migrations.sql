-- ==========================================
-- TECHMON - CONSOLIDATED DATABASE MIGRATION
-- ==========================================
-- This script contains all table definitions, relationships, indexes, 
-- triggers, Row Level Security (RLS) policies, storage buckets, 
-- and Realtime configurations for the Techmon platform.
-- ==========================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. USER PROFILES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  headline TEXT,
  bio TEXT,
  skills TEXT[],
  email TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger function to handle new user signup from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::text, 1, 4),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================
-- 2. POSTS & CONTENT
-- ==========================================

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'code', 'media', 'note', 'repost'
  content TEXT,
  background TEXT,
  code_lang TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image', 'video'
  shared_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);


-- ==========================================
-- 3. FOLLOW SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);


-- ==========================================
-- 4. LIKES & COMMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);


-- ==========================================
-- 5. HASHTAGS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);


-- ==========================================
-- 6. STORIES & HIGHLIGHTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image', -- 'image', 'video'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.highlight_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(highlight_id, story_id)
);


-- ==========================================
-- 7. BOOKMARKS & COLLECTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id, collection_id)
);


-- ==========================================
-- 8. DIRECT MESSAGING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);


-- ==========================================
-- 9. NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'login_alert', 'job_application', etc.
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 10. SECURITY & LOGIN HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 11. MODERATION & REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL, -- 'post', 'comment', 'user'
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'dismissed', 'reviewed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 12. PORTFOLIO PROJECTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[],
  github_url TEXT,
  live_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 13. CAREER & JOB BOARD
-- ==========================================

CREATE TABLE IF NOT EXISTS public.job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  job_type TEXT DEFAULT 'Full-time', -- 'Full-time', 'Part-time', 'Internship', 'Contract'
  work_mode TEXT DEFAULT 'Remote', -- 'Remote', 'Onsite', 'Hybrid'
  description TEXT NOT NULL,
  requirements TEXT,
  apply_url TEXT,
  apply_email TEXT,
  tags TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, applicant_id)
);


-- ==========================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Posts Policies
CREATE POLICY "Public posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users and admins can delete posts" ON public.posts FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Follows Policies
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Likes Policies
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Comments Policies
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can add comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can delete comments" ON public.comments FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Comment Likes Policies
CREATE POLICY "Comment likes are viewable by everyone" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can like comments" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike comments" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Hashtags Policies
CREATE POLICY "Hashtags are viewable by everyone" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create hashtags" ON public.hashtags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Post hashtags are viewable by everyone" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can link hashtags" ON public.post_hashtags FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can unlink post hashtags" ON public.post_hashtags FOR DELETE USING (auth.role() = 'authenticated');

-- Stories Policies
CREATE POLICY "Active stories viewable by everyone" ON public.stories FOR SELECT USING (expires_at > NOW() OR auth.uid() = user_id);
CREATE POLICY "Users can post stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Story Views Policies
CREATE POLICY "Users can view story views" ON public.story_views FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.stories WHERE id = story_id AND user_id = auth.uid())
);
CREATE POLICY "Users can record story view" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Highlights Policies
CREATE POLICY "Highlights are viewable by everyone" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "Users can manage own highlights" ON public.highlights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Highlight stories viewable by everyone" ON public.highlight_stories FOR SELECT USING (true);
CREATE POLICY "Users can manage own highlight stories" ON public.highlight_stories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.highlights WHERE id = highlight_id AND user_id = auth.uid())
);

-- Collections & Saved Posts Policies
CREATE POLICY "Users can manage own collections" ON public.collections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage saved posts" ON public.saved_posts FOR ALL USING (auth.uid() = user_id);

-- Conversations & Messages Policies
CREATE POLICY "Users can view their conversations" ON public.conversations FOR SELECT USING (
  auth.uid() = user1_id OR auth.uid() = user2_id
);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (
  auth.uid() = user1_id OR auth.uid() = user2_id
);

CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = messages.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);
CREATE POLICY "Recipients can update message read status" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  auth.uid() = recipient_id OR auth.uid() = user_id
);
CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
CREATE POLICY "Users can update own notification status" ON public.notifications FOR UPDATE USING (
  auth.uid() = recipient_id OR auth.uid() = user_id
);

-- Login History Policies
CREATE POLICY "Users can view own login history" ON public.login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can record login history" ON public.login_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Moderation & Reports Policies
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view and manage reports" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Projects Policies
CREATE POLICY "Projects are viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Job Board & Applications Policies
CREATE POLICY "Job listings are viewable by everyone" ON public.job_listings FOR SELECT USING (true);
CREATE POLICY "Users can post job listings" ON public.job_listings FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Posters can update own job listings" ON public.job_listings FOR UPDATE USING (auth.uid() = posted_by);
CREATE POLICY "Posters can delete own job listings" ON public.job_listings FOR DELETE USING (auth.uid() = posted_by);

CREATE POLICY "Posters and applicants can view applications" ON public.job_applications FOR SELECT USING (
  auth.uid() = applicant_id OR EXISTS (
    SELECT 1 FROM public.job_listings WHERE id = job_id AND posted_by = auth.uid()
  )
);
CREATE POLICY "Users can submit job applications" ON public.job_applications FOR INSERT WITH CHECK (
  auth.uid() = applicant_id
);


-- ==========================================
-- 15. STORAGE BUCKETS & POLICIES
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('messages', 'messages', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('projects', 'projects', true) ON CONFLICT (id) DO NOTHING;

-- Bucket Storage RLS Policies
CREATE POLICY "Public Read Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Update Avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Public Read Access Posts" ON storage.objects FOR SELECT USING (bucket_id = 'posts');
CREATE POLICY "Authenticated Upload Posts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Delete Posts" ON storage.objects FOR DELETE USING (bucket_id = 'posts' AND auth.role() = 'authenticated');

CREATE POLICY "Public Read Access Stories" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Authenticated Upload Stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "Public Read Access Messages" ON storage.objects FOR SELECT USING (bucket_id = 'messages');
CREATE POLICY "Authenticated Upload Messages" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'messages' AND auth.role() = 'authenticated');

CREATE POLICY "Public Read Access Projects" ON storage.objects FOR SELECT USING (bucket_id = 'projects');
CREATE POLICY "Authenticated Upload Projects" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'projects' AND auth.role() = 'authenticated');


-- ==========================================
-- 16. REALTIME SUBSCRIPTIONS
-- ==========================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


-- ==========================================
-- 17. GROUPS & COMMUNITIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  topic_tags TEXT[],
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'moderator', 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_group ON public.group_posts(group_id);

-- RLS Policies for Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups viewable by everyone" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update own group" ON public.groups FOR UPDATE USING (
  auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "Admins can delete group" ON public.groups FOR DELETE USING (
  auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- Group Members Policies
CREATE POLICY "Group members viewable by everyone" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Users can join public groups or admins can add members" ON public.group_members FOR INSERT WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);
CREATE POLICY "Users can leave or admins can remove members" ON public.group_members FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- Group Posts Policies
CREATE POLICY "Group posts viewable by everyone if public or member if private" ON public.group_posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.groups WHERE id = group_id AND is_private = false
  ) OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_posts.group_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Group members can create posts" ON public.group_posts FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_posts.group_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Post author or group admin can delete post" ON public.group_posts FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_posts.group_id AND user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- Storage bucket for groups
INSERT INTO storage.buckets (id, name, public) VALUES ('groups', 'groups', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Read Access Groups Storage" ON storage.objects FOR SELECT USING (bucket_id = 'groups');
CREATE POLICY "Authenticated Upload Groups Storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'groups' AND auth.role() = 'authenticated');

-- ==========================================
-- 20. CLEANUP & MAINTENANCE FUNCTIONS
-- ==========================================

-- Function to clean up expired stories and their storage media (if not saved in highlights)
CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT := 0;
  rec RECORD;
  file_name TEXT;
BEGIN
  FOR rec IN 
    SELECT s.id, s.media_url
    FROM public.stories s
    WHERE s.expires_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.highlight_stories hs WHERE hs.story_id = s.id
      )
  LOOP
    file_name := substring(rec.media_url from '/stories/(.*)$');
    IF file_name IS NOT NULL AND file_name <> '' THEN
      DELETE FROM storage.objects 
      WHERE bucket_id = 'stories' AND name = file_name;
    END IF;

    DELETE FROM public.stories WHERE id = rec.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- Ensure ON DELETE CASCADE for threaded comment replies
ALTER TABLE public.comments 
  DROP CONSTRAINT IF EXISTS comments_parent_comment_id_fkey,
  ADD CONSTRAINT comments_parent_comment_id_fkey 
  FOREIGN KEY (parent_comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


