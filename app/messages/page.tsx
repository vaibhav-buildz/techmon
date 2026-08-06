"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Conversation, Message } from "@/lib/types";
import Link from "next/link";
import {
  Send,
  MessageCircle,
  ArrowLeft,
  Plus,
  Camera,
  Image as ImageIcon,
  FileText,
  Mic,
  BarChart2,
  X,
  Download,
  Trash2,
  Check,
  CheckCircle2,
  CornerUpLeft,
  Copy,
  MoreVertical,
  EyeOff
} from "lucide-react";
import CameraCaptureModal from "@/components/CameraCaptureModal";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string;
  username?: string;
};

type ConversationWithDetails = Conversation & {
  otherUser: UserProfile;
  lastMessage?: Message;
  unreadCount: number;
};

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function getMessageSnippet(msg: Message): string {
  if (msg.deleted) return "This message was unsent";
  if (msg.media_type === "poll") {
    try {
      const p = JSON.parse(msg.content);
      return `📊 Poll: ${p.question || "Poll"}`;
    } catch (e) {
      return "📊 Poll";
    }
  }
  if (msg.media_type === "contact_share") {
    try {
      const c = JSON.parse(msg.content);
      return `👤 Contact: ${c.name || "User"}`;
    } catch (e) {
      return "👤 Contact";
    }
  }
  if (msg.media_type === "document") return `📄 ${msg.content || "Document"}`;
  if (msg.media_type === "audio") return "🎵 Voice Note";
  if (msg.media_type === "image") return "📷 Photo";
  if (msg.media_type === "video") return "🎥 Video";
  return msg.content || "Message";
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("conversation");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Media & Attachment States
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | "document" | "audio" | "contact_share" | "poll" | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [docSize, setDocSize] = useState<number>(0);
  
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Poll Creator Modal States
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Reply & Message Actions States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hiddenMsgIds, setHiddenMsgIds] = useState<Set<string>>(new Set());
  const [contextMenuMsg, setContextMenuMsg] = useState<{ msg: Message; position?: { x: number; y: number } } | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Mobile Touch Gesture Refs
  const longPressTimerRef = useRef<any>(null);
  const lastTapRef = useRef<{ time: number; msgId: string } | null>(null);

  // Load hidden message IDs from localStorage on user fetch
  useEffect(() => {
    if (currentUser && typeof window !== "undefined") {
      const stored = localStorage.getItem(`techmon_hidden_messages_${currentUser.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setHiddenMsgIds(new Set(parsed));
        } catch (e) {
          console.error("Error reading hidden messages", e);
        }
      }
    }
  }, [currentUser]);

  // Fetch initial data
  useEffect(() => {
    const fetchUserAndConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      // Load hidden set for preview filtering
      let storedHiddenSet = new Set<string>();
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`techmon_hidden_messages_${user.id}`);
        if (stored) {
          try {
            storedHiddenSet = new Set(JSON.parse(stored));
            setHiddenMsgIds(storedHiddenSet);
          } catch (e) {}
        }
      }

      // Fetch conversations
      const { data: convos, error: convosError } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (convosError || !convos) {
        setLoading(false);
        return;
      }

      const otherUserIds = convos.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, username")
        .in("id", otherUserIds);

      const convoDetails: ConversationWithDetails[] = await Promise.all(convos.map(async (c) => {
        const otherUserId = c.user1_id === user.id ? c.user2_id : c.user1_id;
        const profile = profiles?.find(p => p.id === otherUserId) || { id: otherUserId, name: 'Unknown User' };

        // Fetch recent messages to find latest non-hidden message for preview
        const { data: recentMsgs } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const visibleLastMsg = recentMsgs?.find(m => !m.deleted && !storedHiddenSet.has(m.id));

        const { count } = await supabase
          .from("messages")
          .select("*", { count: 'exact', head: true })
          .eq("conversation_id", c.id)
          .eq("read", false)
          .neq("sender_id", user.id);

        return {
          ...c,
          otherUser: profile,
          lastMessage: visibleLastMsg || undefined,
          unreadCount: count || 0
        };
      }));

      convoDetails.sort((a, b) => {
        const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setConversations(convoDetails);
      setLoading(false);
    };

    fetchUserAndConversations();
  }, [router]);

  // Fetch active conversation messages and mark as read
  useEffect(() => {
    if (!currentUser || !activeConversationId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data);
      }

      await supabase
        .from("messages")
        .update({ read: true })
        .eq("conversation_id", activeConversationId)
        .eq("read", false)
        .neq("sender_id", currentUser.id);

      setConversations(prev => prev.map(c => 
        c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
      ));
    };

    fetchMessages();
  }, [currentUser, activeConversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as Message;

          if (newMsg.conversation_id === activeConversationId) {
            setMessages(prev => [...prev.filter(m => m.id !== newMsg.id), newMsg]);
            
            if (newMsg.sender_id !== currentUser.id) {
              await supabase
                .from("messages")
                .update({ read: true })
                .eq("id", newMsg.id);
            }
          }

          setConversations(prev => {
            let updated = prev.map(c => {
              if (c.id === newMsg.conversation_id) {
                const isUnread = newMsg.sender_id !== currentUser.id && newMsg.conversation_id !== activeConversationId;
                return {
                  ...c,
                  lastMessage: newMsg,
                  unreadCount: isUnread ? c.unreadCount + 1 : c.unreadCount
                };
              }
              return c;
            });
            
            updated.sort((a, b) => {
              const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.created_at).getTime();
              const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.created_at).getTime();
              return dateB - dateA;
            });
            
            return updated;
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as Message;
          if (updatedMsg.conversation_id === activeConversationId) {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }

          if (updatedMsg.deleted) {
            const nextLast = await getOrFetchNextVisibleMessage(
              updatedMsg.conversation_id,
              updatedMsg.id,
              hiddenMsgIds,
              messages
            );
            setConversations(prev => {
              const updated = prev.map(c => {
                if (c.id === updatedMsg.conversation_id && c.lastMessage?.id === updatedMsg.id) {
                  return { ...c, lastMessage: nextLast };
                }
                return c;
              });
              updated.sort((a, b) => {
                const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.created_at).getTime();
                const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.created_at).getTime();
                return dateB - dateA;
              });
              return updated;
            });
          } else {
            setConversations(prev => prev.map(c => {
              if (c.id === updatedMsg.conversation_id && c.lastMessage?.id === updatedMsg.id) {
                return { ...c, lastMessage: updatedMsg };
              }
              return c;
            }));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, activeConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Voice Note Recording logic
  const startRecording = async () => {
    try {
      setShowAttachmentMenu(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setMediaFile(audioBlob);
        setMediaType("audio");
        setMediaPreview(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Microphone access is required to record voice notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      const stream = mediaRecorderRef.current.stream;
      stream?.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll to original message
  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  };

  // Primary Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent, customPayload?: { content: string; media_type: any; media_url?: string }) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeConversationId || isSending) return;

    let content = customPayload ? customPayload.content : newMessage.trim();
    let currentMediaType = customPayload ? customPayload.media_type : mediaType;
    let currentMediaFile = customPayload ? null : mediaFile;
    const replyToId = replyingTo ? replyingTo.id : undefined;

    if (!content && !currentMediaFile && !currentMediaType) return;

    setIsSending(true);
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    let tempMediaUrl = mediaPreview;

    // Build Optimistic Message
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      content,
      read: false,
      created_at: new Date().toISOString(),
      media_url: tempMediaUrl || undefined,
      media_type: currentMediaType || undefined,
      reply_to_id: replyToId
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    // Clear local states
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setDocName("");
    setDocSize(0);
    setShowAttachmentMenu(false);
    setReplyingTo(null);
    
    setConversations(prev => {
      let updated = prev.map(c => {
        if (c.id === activeConversationId) {
          return { ...c, lastMessage: optimisticMsg };
        }
        return c;
      });
      const idx = updated.findIndex(c => c.id === activeConversationId);
      if (idx > 0) {
        const item = updated.splice(idx, 1)[0];
        updated.unshift(item);
      }
      return updated;
    });

    let uploadedMediaUrl = customPayload?.media_url || null;

    // Handle File Uploads for image, video, document, audio
    if (currentMediaFile && !uploadedMediaUrl) {
      let fileExt = "bin";
      if (currentMediaType === "video") fileExt = "mp4";
      else if (currentMediaType === "image") fileExt = "jpg";
      else if (currentMediaType === "audio") fileExt = "webm";
      else if (currentMediaType === "document" && docName) {
        fileExt = docName.split('.').pop() || "bin";
      }

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;
      
      let contentType = currentMediaFile.type || "application/octet-stream";
      if (currentMediaType === "video" && !currentMediaFile.type) contentType = "video/mp4";
      if (currentMediaType === "image" && !currentMediaFile.type) contentType = "image/jpeg";
      if (currentMediaType === "audio" && !currentMediaFile.type) contentType = "audio/webm";

      const { error: uploadError } = await supabase.storage
        .from("messages")
        .upload(filePath, currentMediaFile, { contentType });
        
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("messages").getPublicUrl(filePath);
        uploadedMediaUrl = publicUrlData.publicUrl;
      } else {
        console.error("Storage upload error:", uploadError);
      }
    }

    // Insert Message Row
    const { error, data } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        sender_id: currentUser.id,
        content,
        media_url: uploadedMediaUrl,
        media_type: currentMediaType,
        reply_to_id: replyToId
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to send message", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data as Message : m));
    }
    setIsSending(false);
  };

  // Helper to recompute the most recent visible message for conversation preview
  const getOrFetchNextVisibleMessage = async (
    convoId: string,
    ignoreMsgId: string,
    currentHiddenSet: Set<string>,
    currentMessages: Message[]
  ): Promise<Message | undefined> => {
    const localVisible = currentMessages
      .filter(m => m.conversation_id === convoId && m.id !== ignoreMsgId && !m.deleted && !currentHiddenSet.has(m.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (localVisible.length > 0) {
      return localVisible[localVisible.length - 1];
    }

    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoId)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!recentMsgs) return undefined;
    return recentMsgs.find(m => m.id !== ignoreMsgId && !m.deleted && !currentHiddenSet.has(m.id));
  };

  // Actions Handlers
  const handleDeleteForMe = async (msg: Message) => {
    if (!currentUser) return;
    const newHiddenSet = new Set(hiddenMsgIds);
    newHiddenSet.add(msg.id);
    setHiddenMsgIds(newHiddenSet);

    if (typeof window !== "undefined") {
      localStorage.setItem(
        `techmon_hidden_messages_${currentUser.id}`,
        JSON.stringify(Array.from(newHiddenSet))
      );
    }
    setContextMenuMsg(null);

    // Update conversation sidebar preview if this was the preview message for current user
    const affectedConvo = conversations.find(c => c.id === msg.conversation_id && c.lastMessage?.id === msg.id);
    if (affectedConvo) {
      const nextLast = await getOrFetchNextVisibleMessage(msg.conversation_id, msg.id, newHiddenSet, messages);
      setConversations(prev => {
        const updated = prev.map(c => c.id === msg.conversation_id ? { ...c, lastMessage: nextLast } : c);
        updated.sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.created_at).getTime();
          const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        return updated;
      });
    }
  };

  const handleUnsend = async (msg: Message) => {
    if (!currentUser || msg.sender_id !== currentUser.id) return;

    const isWithinHour = (Date.now() - new Date(msg.created_at).getTime()) < 3600000;
    if (!isWithinHour) {
      alert("Messages can only be unsent within 1 hour of sending.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to unsend this message for everyone?");
    if (!confirmed) return;

    setContextMenuMsg(null);

    // Optimistic update for active chat messages
    const updatedMessages = messages.map(m => m.id === msg.id ? { ...m, deleted: true } : m);
    setMessages(updatedMessages);

    // Optimistic update for conversation sidebar preview
    const affectedConvo = conversations.find(c => c.id === msg.conversation_id && c.lastMessage?.id === msg.id);
    if (affectedConvo) {
      const nextLast = await getOrFetchNextVisibleMessage(msg.conversation_id, msg.id, hiddenMsgIds, updatedMessages);
      setConversations(prev => {
        const updated = prev.map(c => c.id === msg.conversation_id ? { ...c, lastMessage: nextLast } : c);
        updated.sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : new Date(a.created_at).getTime();
          const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        return updated;
      });
    }

    // Delete file attachment from storage if present
    if (msg.media_url) {
      try {
        const filePath = msg.media_url.includes("/messages/")
          ? msg.media_url.split("/messages/").pop()
          : null;

        if (filePath) {
          await supabase.storage.from("messages").remove([filePath]);
        }
      } catch (err) {
        console.error("Error deleting message attachment from storage:", err);
      }
    }

    // DB update
    const { error } = await supabase
      .from("messages")
      .update({ deleted: true })
      .eq("id", msg.id);

    if (error) {
      console.error("Error unsending message:", error);
    }
  };

  const handleCopyMessage = (msg: Message) => {
    const text = getMessageSnippet(msg);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setContextMenuMsg(null);
  };

  // Touch Gesture Handlers for Mobile
  const handleTouchStart = (msg: Message, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setContextMenuMsg({ msg, position: { x: touch.clientX, y: touch.clientY } });
    }, 500);
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = (msg: Message) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.msgId === msg.id && (now - lastTapRef.current.time) < 300) {
      // Double tap detected -> Reply!
      setReplyingTo(msg);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, msgId: msg.id };
    }
  };

  // Image/Video selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
      setMediaPreview(URL.createObjectURL(file));
      setShowAttachmentMenu(false);
    }
  };

  // Document selection
  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaType("document");
      setDocName(file.name);
      setDocSize(file.size);
      setMediaPreview(file.name);
      setShowAttachmentMenu(false);
    }
  };

  // Camera capture
  const handleCameraCapture = (blob: Blob, type: "image" | "video") => {
    setMediaFile(blob);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(blob));
    setIsCameraModalOpen(false);
  };

  // Poll Creation
  const handleCreatePoll = () => {
    const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert("Please provide a question and at least 2 options.");
      return;
    }
    const payload = JSON.stringify({
      question: pollQuestion.trim(),
      options: validOptions,
      votes: {}
    });
    setIsPollModalOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    handleSendMessage(undefined, {
      content: payload,
      media_type: "poll"
    });
  };

  // Poll Vote Handler
  const handleVotePoll = async (msg: Message, optionIdx: number) => {
    if (!currentUser || msg.deleted) return;
    try {
      let pollData = JSON.parse(msg.content);
      if (!pollData.votes) pollData.votes = {};

      pollData.votes[currentUser.id] = optionIdx;
      const updatedContent = JSON.stringify(pollData);

      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: updatedContent } : m));

      await supabase
        .from("messages")
        .update({ content: updatedContent })
        .eq("id", msg.id);
    } catch (err) {
      console.error("Error voting on poll:", err);
    }
  };

  const cancelMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setDocName("");
    setDocSize(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Left Panel: Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border bg-surface flex flex-col ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border bg-surface z-10 shrink-0">
          <h1 className="text-xl font-heading font-bold text-heading">Messages</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-body flex flex-col items-center">
              <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
              <p>No messages yet. Start a conversation from someone's profile.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {conversations.map((convo) => (
                <li key={convo.id}>
                  <Link 
                    href={`/messages?conversation=${convo.id}`}
                    className={`block p-4 hover:bg-gray-50 transition-colors ${activeConversationId === convo.id ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-border">
                        {convo.otherUser.avatar_url ? (
                          <img src={convo.otherUser.avatar_url} alt={convo.otherUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                            {convo.otherUser.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className={`text-sm font-semibold truncate ${convo.unreadCount > 0 ? 'text-heading' : 'text-heading'}`}>
                            {convo.otherUser.name}
                          </h3>
                          {convo.lastMessage && (
                            <span className="text-xs text-gray-400 shrink-0 ml-2">
                              {new Date(convo.lastMessage.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <p className={`text-sm truncate ${convo.unreadCount > 0 ? 'text-heading font-medium' : 'text-gray-500'}`}>
                            {convo.lastMessage ? (
                              <>
                                {convo.lastMessage.sender_id === currentUser?.id && <span className="text-gray-400">You: </span>}
                                {getMessageSnippet(convo.lastMessage)}
                              </>
                            ) : (
                              <span className="italic text-gray-400">New conversation</span>
                            )}
                          </p>
                          {convo.unreadCount > 0 && (
                            <span className="shrink-0 w-2.5 h-2.5 bg-accent rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Panel: Active Chat */}
      <div className={`flex-1 bg-background flex flex-col relative ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {!activeConversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-heading font-semibold text-heading mb-2">Your Messages</h2>
            <p className="text-body max-w-sm">Select a conversation from the sidebar or start a new one from a user's profile.</p>
          </div>
        ) : activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-14 shrink-0 border-b border-border bg-surface px-4 flex items-center gap-3 z-10">
              <Link href="/messages" className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-body">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link href={`/profile/${activeConversation.otherUser.username || activeConversation.otherUser.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border">
                  {activeConversation.otherUser.avatar_url ? (
                    <img src={activeConversation.otherUser.avatar_url} alt={activeConversation.otherUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                      {activeConversation.otherUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="font-semibold text-sm text-heading">{activeConversation.otherUser.name}</div>
              </Link>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Say hi to {activeConversation.otherUser.name}!
                </div>
              ) : (
                messages.filter(m => !hiddenMsgIds.has(m.id)).map((msg, i) => {
                  const isMine = msg.sender_id === currentUser.id;
                  const showTimestamp = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000;
                  const isHighlighted = highlightedMsgId === msg.id;

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className="flex flex-col transition-all duration-300">
                      {showTimestamp && (
                        <div className="text-center my-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      
                      <div className={`flex items-center gap-2 group ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {/* Hover '...' Action Button for Mine */}
                        {isMine && !msg.deleted && (
                          <button
                            onClick={() => setContextMenuMsg({ msg })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-opacity"
                            title="Message options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}

                        <div
                          onDoubleClick={() => setReplyingTo(msg)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenuMsg({ msg, position: { x: e.clientX, y: e.clientY } });
                          }}
                          onTouchStart={(e) => handleTouchStart(msg, e)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={() => handleTouchEnd(msg)}
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-[15px] leading-relaxed shadow-sm transition-all select-none cursor-pointer ${
                            isHighlighted ? 'ring-2 ring-[#DC2626] scale-[1.01]' : ''
                          } ${
                            isMine 
                              ? 'bg-accent text-white rounded-br-sm' 
                              : 'bg-white border border-border text-heading rounded-bl-sm'
                          }`}
                        >
                          {/* Deleted Message State */}
                          {msg.deleted ? (
                            <p className={`italic text-sm ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                              This message was unsent
                            </p>
                          ) : (
                            <>
                              {/* Quoted Replied-to Message Card */}
                              {msg.reply_to_id && (() => {
                                const parentMsg = messages.find(m => m.id === msg.reply_to_id);
                                if (!parentMsg) return null;
                                const parentSenderName = parentMsg.sender_id === currentUser?.id
                                  ? "You"
                                  : activeConversation?.otherUser.name || "User";
                                const parentSnippet = getMessageSnippet(parentMsg);

                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      scrollToMessage(msg.reply_to_id!);
                                    }}
                                    className={`w-full text-left p-2 mb-2 rounded-xl border-l-4 transition-opacity flex items-center gap-2 ${
                                      isMine
                                        ? 'bg-black/15 border-white text-white'
                                        : 'bg-gray-100 border-[#DC2626] text-heading'
                                    } hover:opacity-80`}
                                  >
                                    <CornerUpLeft className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold truncate">{parentSenderName}</div>
                                      <div className="text-xs truncate opacity-80">{parentSnippet}</div>
                                    </div>
                                  </button>
                                );
                              })()}

                              {/* Image & Video Render */}
                              {msg.media_url && (msg.media_type === "image" || msg.media_type === "video") && (
                                <div className="mb-2 -mx-1 -mt-1 overflow-hidden rounded-xl relative">
                                  {msg.media_type === "video" ? (
                                    <video src={msg.media_url} controls className="w-full max-h-64 object-cover" />
                                  ) : (
                                    <img src={msg.media_url} alt="Attachment" className="w-full max-h-64 object-cover" />
                                  )}
                                </div>
                              )}

                              {/* Document Render */}
                              {msg.media_type === "document" && (
                                <div className={`p-3 rounded-xl border flex items-center gap-3 mb-2 ${
                                  isMine ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 border-border text-heading'
                                }`}>
                                  <div className={`p-2.5 rounded-lg shrink-0 ${isMine ? 'bg-white/20' : 'bg-gray-200 text-gray-700'}`}>
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{msg.content || "Document"}</div>
                                    <div className={`text-xs ${isMine ? 'text-white/70' : 'text-gray-500'} font-mono uppercase mt-0.5`}>
                                      Document File
                                    </div>
                                  </div>
                                  {msg.media_url && (
                                    <a
                                      href={msg.media_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className={`p-2 rounded-full transition-colors ${
                                        isMine ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-600'
                                      }`}
                                      title="Download Document"
                                    >
                                      <Download className="w-5 h-5" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Voice Note Audio Render */}
                              {msg.media_type === "audio" && (
                                <div className="mb-1 py-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Mic className="w-4 h-4" />
                                    <span className="text-xs font-mono uppercase tracking-wider">Voice Note</span>
                                  </div>
                                  {msg.media_url ? (
                                    <audio controls src={msg.media_url} className="w-full max-w-xs h-10 rounded" />
                                  ) : (
                                    <div className="text-xs italic">Audio uploading...</div>
                                  )}
                                </div>
                              )}

                              {/* Poll Render */}
                              {msg.media_type === "poll" && (() => {
                                try {
                                  const pollData = JSON.parse(msg.content);
                                  const votesObj = pollData.votes || {};
                                  const totalVotes = Object.keys(votesObj).length;
                                  const myVote = votesObj[currentUser?.id];

                                  return (
                                    <div className={`p-3 rounded-xl border flex flex-col gap-3 min-w-[260px] max-w-full ${
                                      isMine ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-border text-heading'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <BarChart2 className={`w-4 h-4 ${isMine ? 'text-white' : 'text-[#DC2626]'}`} />
                                        <span className="text-xs font-mono uppercase tracking-wider opacity-80">Poll</span>
                                      </div>
                                      <div className="font-bold text-base">{pollData.question}</div>
                                      
                                      <div className="space-y-2">
                                        {pollData.options.map((opt: string, idx: number) => {
                                          const optionVotes = Object.values(votesObj).filter(v => v === idx).length;
                                          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                                          const isSelected = myVote === idx;

                                          return (
                                            <button
                                              key={idx}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleVotePoll(msg, idx);
                                              }}
                                              className={`w-full relative overflow-hidden rounded-lg border text-left p-2.5 transition-all flex items-center justify-between ${
                                                isSelected
                                                  ? isMine
                                                    ? 'border-white bg-white/20 font-semibold'
                                                    : 'border-[#DC2626] bg-[#DC2626]/10 font-semibold text-heading'
                                                  : isMine
                                                  ? 'border-white/20 bg-white/5 hover:bg-white/10'
                                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-heading'
                                              }`}
                                            >
                                              <div
                                                className={`absolute left-0 top-0 bottom-0 transition-all ${
                                                  isMine ? 'bg-white/20' : 'bg-[#DC2626]/20'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                              />
                                              
                                              <div className="relative z-10 flex items-center gap-2 min-w-0 flex-1 pr-2">
                                                {isSelected && (
                                                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${isMine ? 'text-white' : 'text-[#DC2626]'}`} />
                                                )}
                                                <span className="text-sm truncate">{opt}</span>
                                              </div>
                                              
                                              <div className="relative z-10 text-xs font-mono shrink-0 opacity-80">
                                                {pct}% ({optionVotes})
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="text-[11px] font-mono opacity-70 border-t border-current/10 pt-2 flex justify-between">
                                        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total</span>
                                        {myVote !== undefined && <span className="font-semibold">Voted</span>}
                                      </div>
                                    </div>
                                  );
                                } catch (e) {
                                  return <p>{msg.content}</p>;
                                }
                              })()}

                              {/* Standard Text Content */}
                              {msg.content && msg.media_type !== "poll" && (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Hover '...' Action Button for Others */}
                        {!isMine && !msg.deleted && (
                          <button
                            onClick={() => setContextMenuMsg({ msg })}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-opacity"
                            title="Message options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input & Attachment Menu */}
            <div className="p-4 bg-surface border-t border-border shrink-0 pb-safe">
              {/* Active Reply Preview Bar */}
              {replyingTo && (
                <div className="mb-3 p-2.5 bg-gray-100 border-l-4 border-[#DC2626] rounded-r-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <CornerUpLeft className="w-4 h-4 text-[#DC2626] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-heading truncate">
                        Replying to {replyingTo.sender_id === currentUser?.id ? "yourself" : activeConversation.otherUser.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {getMessageSnippet(replyingTo)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                    title="Cancel Reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Media Preview Box */}
              {mediaPreview && (
                <div className="mb-3 relative inline-block">
                  <div className="p-3 rounded-xl border border-border bg-gray-100 flex items-center gap-3">
                    {mediaType === "video" ? (
                      <video src={mediaPreview} className="w-16 h-16 object-cover rounded-lg" />
                    ) : mediaType === "image" ? (
                      <img src={mediaPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                    ) : mediaType === "audio" ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-heading">
                        <Mic className="w-5 h-5 text-[#DC2626]" />
                        <span className="font-medium">Voice Note Ready</span>
                      </div>
                    ) : mediaType === "document" ? (
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-[#DC2626]" />
                        <div>
                          <div className="text-sm font-semibold text-heading max-w-xs truncate">{docName}</div>
                          <div className="text-xs text-gray-500 font-mono">{formatBytes(docSize)}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={cancelMedia}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Voice Note Recording Bar */}
              {isRecording ? (
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-full px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                    <span className="text-sm font-mono font-semibold text-red-600">{formatTimer(recordingTime)}</span>
                    <span className="text-xs text-gray-500 hidden sm:inline">Recording voice note...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                      title="Cancel Recording"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="p-2 bg-[#DC2626] text-white hover:bg-[#DC2626]/90 rounded-full transition-colors"
                      title="Done Recording"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* WhatsApp Style Attachment Popover Menu */}
                  {showAttachmentMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAttachmentMenu(false)} />
                      <div className="absolute bottom-full left-0 mb-3 bg-surface border border-border shadow-xl rounded-2xl overflow-hidden z-20 p-2 w-56 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400 px-3 py-1 mb-1">
                          Attach
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <span className="font-medium">Photos & Videos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            setIsCameraModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
                            <Camera className="w-4 h-4" />
                          </div>
                          <span className="font-medium">Camera</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            docInputRef.current?.click();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="p-2 bg-[#DC2626]/10 text-[#DC2626] rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="font-medium">Document</span>
                        </button>

                        <button
                          type="button"
                          onClick={startRecording}
                          className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Mic className="w-4 h-4" />
                          </div>
                          <span className="font-medium">Voice Note</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachmentMenu(false);
                            setIsPollModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <BarChart2 className="w-4 h-4" />
                          </div>
                          <span className="font-medium">Poll</span>
                        </button>
                      </div>
                    </>
                  )}

                  <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className={`p-2.5 rounded-full transition-colors shrink-0 ${
                        showAttachmentMenu ? 'bg-gray-200 text-heading' : 'text-gray-500 hover:text-heading hover:bg-gray-100'
                      }`}
                      title="Add Attachment"
                    >
                      <Plus className={`w-5 h-5 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`} />
                    </button>

                    {/* Hidden Inputs */}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    <input
                      type="file"
                      accept="*/*"
                      className="hidden"
                      ref={docInputRef}
                      onChange={handleDocSelect}
                    />

                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                      className="flex-1 bg-gray-100 border-none rounded-full px-5 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />

                    <button
                      type="submit"
                      disabled={(!newMessage.trim() && !mediaFile && !mediaType) || isSending}
                      className="p-2.5 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-body">
            Conversation not found.
          </div>
        )}
      </div>

      {/* Camera Capture Modal */}
      {isCameraModalOpen && currentUser && (
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          userId={currentUser.id}
          mode="message"
          onCapture={handleCameraCapture}
        />
      )}

      {/* Poll Creator Modal */}
      {isPollModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-heading">Create a Poll</h3>
              <button onClick={() => setIsPollModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-gray-100 border-none rounded-xl px-4 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-500">
                  Options
                </label>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...pollOptions];
                        updated[idx] = e.target.value;
                        setPollOptions(updated);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  className="text-xs font-semibold text-[#DC2626] hover:underline"
                >
                  + Add Option
                </button>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setIsPollModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePoll}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#DC2626] text-white hover:bg-[#DC2626]/90 transition-colors"
              >
                Send Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Context Actions Popover Menu */}
      {contextMenuMsg && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenuMsg(null)} />
          <div
            className="fixed z-50 bg-surface border border-border shadow-2xl rounded-2xl p-2 w-52 animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: contextMenuMsg.position
                ? Math.min(contextMenuMsg.position.y, typeof window !== "undefined" ? window.innerHeight - 200 : 400)
                : "40%",
              left: contextMenuMsg.position
                ? Math.min(contextMenuMsg.position.x, typeof window !== "undefined" ? window.innerWidth - 220 : 300)
                : "45%"
            }}
          >
            <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400 px-3 py-1 mb-1 border-b border-border">
              Message Options
            </div>

            {/* Reply Option */}
            <button
              onClick={() => {
                setReplyingTo(contextMenuMsg.msg);
                setContextMenuMsg(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
            >
              <CornerUpLeft className="w-4 h-4 text-[#DC2626]" />
              <span className="font-medium">Reply</span>
            </button>

            {/* Copy Option */}
            {!contextMenuMsg.msg.deleted && (
              <button
                onClick={() => handleCopyMessage(contextMenuMsg.msg)}
                className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
              >
                <Copy className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Copy Text</span>
              </button>
            )}

            {/* Delete for Me Option */}
            <button
              onClick={() => handleDeleteForMe(contextMenuMsg.msg)}
              className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-100 rounded-xl flex items-center gap-3 transition-colors"
            >
              <EyeOff className="w-4 h-4 text-gray-600" />
              <span className="font-medium">Delete for me</span>
            </button>

            {/* Unsend / Delete for Everyone (If sender & < 1 hour) */}
            {contextMenuMsg.msg.sender_id === currentUser?.id &&
              !contextMenuMsg.msg.deleted &&
              (Date.now() - new Date(contextMenuMsg.msg.created_at).getTime()) < 3600000 && (
                <button
                  onClick={() => handleUnsend(contextMenuMsg.msg)}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors border-t border-border mt-1 pt-2"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span className="font-medium">Unsend for everyone</span>
                </button>
              )}
          </div>
        </>
      )}
    </div>
  );
}
