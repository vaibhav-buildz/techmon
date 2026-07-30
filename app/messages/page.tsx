"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Conversation, Message } from "@/lib/types";
import Link from "next/link";
import { Send, MessageCircle, ArrowLeft, Paperclip, Camera, Image as ImageIcon, X } from "lucide-react";
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

  // Media sharing states
  const [mediaFile, setMediaFile] = useState<File | Blob | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchUserAndConversations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

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

        const { data: lastMsgData } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count } = await supabase
          .from("messages")
          .select("*", { count: 'exact', head: true })
          .eq("conversation_id", c.id)
          .eq("read", false)
          .neq("sender_id", user.id);

        return {
          ...c,
          otherUser: profile,
          lastMessage: lastMsgData || undefined,
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as Message;

        if (newMsg.conversation_id === activeConversationId) {
          setMessages(prev => [...prev, newMsg]);
          
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !currentUser || !activeConversationId || isSending) return;

    setIsSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    let tempMediaUrl = mediaPreview;
    let currentMediaType = mediaType;
    let currentMediaFile = mediaFile;

    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      content,
      read: false,
      created_at: new Date().toISOString(),
      media_url: tempMediaUrl || undefined,
      media_type: currentMediaType || undefined
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    // Clear local state so user can type next message
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setShowAttachmentMenu(false);
    
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

    let uploadedMediaUrl = null;
    if (currentMediaFile) {
      const fileExt = currentMediaType === "video" ? "mp4" : "jpg";
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("messages")
        .upload(filePath, currentMediaFile, { contentType: currentMediaFile.type || (currentMediaType === "video" ? "video/mp4" : "image/jpeg") });
        
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("messages").getPublicUrl(filePath);
        uploadedMediaUrl = publicUrlData.publicUrl;
      }
    }

    const { error, data } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        sender_id: currentUser.id,
        content,
        media_url: uploadedMediaUrl,
        media_type: currentMediaType
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
      setMediaPreview(URL.createObjectURL(file));
      setShowAttachmentMenu(false);
    }
  };

  const handleCameraCapture = (blob: Blob, type: "image" | "video") => {
    setMediaFile(blob);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(blob));
    setIsCameraModalOpen(false);
  };

  const cancelMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
                                {convo.lastMessage.content}
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
                messages.map((msg, i) => {
                  const isMine = msg.sender_id === currentUser.id;
                  const showTimestamp = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000;
                  
                  return (
                    <div key={msg.id} className="flex flex-col">
                      {showTimestamp && (
                        <div className="text-center my-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed shadow-sm ${
                          isMine 
                            ? 'bg-accent text-white rounded-br-sm' 
                            : 'bg-white border border-border text-heading rounded-bl-sm'
                        }`}>
                          {msg.media_url && (
                            <div className="mb-2 -mx-2 -mt-1 overflow-hidden rounded-t-xl relative">
                              {msg.media_type === "video" ? (
                                <video src={msg.media_url} controls className="w-full max-h-64 object-cover" />
                              ) : (
                                <img src={msg.media_url} alt="Attachment" className="w-full max-h-64 object-cover" />
                              )}
                            </div>
                          )}
                          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-surface border-t border-border shrink-0 pb-safe">
              {mediaPreview && (
                <div className="mb-3 relative inline-block">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-gray-100">
                    {mediaType === "video" ? (
                      <video src={mediaPreview} className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <button
                    onClick={cancelMedia}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="relative">
                {showAttachmentMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAttachmentMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 bg-surface border border-border shadow-lg rounded-xl overflow-hidden z-20 py-1 w-48">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" /> Upload from device
                      </button>
                      <button
                        onClick={() => {
                          setShowAttachmentMenu(false);
                          setIsCameraModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Take Photo
                      </button>
                    </div>
                  </>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className="p-2 text-gray-400 hover:text-heading hover:bg-gray-100 rounded-full transition-colors shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                  />
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-100 border-none rounded-full px-5 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !mediaFile) || isSending}
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
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-body">
            Conversation not found.
          </div>
        )}
      </div>
      {isCameraModalOpen && currentUser && (
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          userId={currentUser.id}
          mode="message"
          onCapture={handleCameraCapture}
        />
      )}
    </div>
  );
}
