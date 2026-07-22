"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Conversation, Message } from "@/lib/types";
import Link from "next/link";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";

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
    if (!newMessage.trim() || !currentUser || !activeConversationId) return;

    const content = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      content,
      read: false,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
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

    const { error, data } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversationId,
        sender_id: currentUser.id,
        content
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to send message", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data as Message : m));
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  if (loading) {
    return (
      <div className="h-screen pt-14 md:pt-16 pb-14 md:pb-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen pt-14 md:pt-16 pb-14 md:pb-0 bg-background flex overflow-hidden">
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
                            ? 'bg-[#2F5D8A] text-white rounded-br-sm' 
                            : 'bg-white border border-gray-100 text-heading rounded-bl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-surface border-t border-border shrink-0">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-100 border-none rounded-full px-5 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2.5 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-body">
            Conversation not found.
          </div>
        )}
      </div>
    </div>
  );
}
