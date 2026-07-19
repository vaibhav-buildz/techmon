"use client";

import { useState, useEffect, useRef } from "react";
import { Bookmark, ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Collection = {
  id: string;
  name: string;
};

type Props = {
  postId: string;
  currentUserId: string;
  initialSavedCollectionIds?: string[];
  className?: string;
  iconClassName?: string;
};

export default function SaveButton({
  postId,
  currentUserId,
  initialSavedCollectionIds = [],
  className = "",
  iconClassName = "w-5 h-5",
}: Props) {
  const [savedCollectionIds, setSavedCollectionIds] = useState<string[]>(initialSavedCollectionIds);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const isSavedToAny = savedCollectionIds.length > 0;

  useEffect(() => {
    setSavedCollectionIds(initialSavedCollectionIds);
  }, [initialSavedCollectionIds]);

  const fetchCollections = async () => {
    const { data, error } = await supabase
      .from("collections")
      .select("id, name")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: true });
    
    if (!error && data) {
      setCollections(data);
      return data;
    }
    return [];
  };

  const handleQuickSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return;
    
    if (isSavedToAny) {
      // Unsave from all collections it is currently in
      const { error } = await supabase
        .from("saved_posts")
        .delete()
        .match({ post_id: postId, user_id: currentUserId });
        
      if (!error) {
        setSavedCollectionIds([]);
      }
      return;
    }

    // Quick save to "All Posts"
    let currentCols = collections;
    if (currentCols.length === 0) {
      currentCols = await fetchCollections();
    }

    let defaultCol = currentCols.find(c => c.name === "All Posts");
    if (!defaultCol) {
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: currentUserId, name: "All Posts" })
        .select()
        .single();
        
      if (!error && data) {
        defaultCol = data;
        setCollections([...currentCols, data]);
      }
    }

    if (defaultCol) {
      const { error } = await supabase
        .from("saved_posts")
        .insert({
          user_id: currentUserId,
          post_id: postId,
          collection_id: defaultCol.id,
        });

      if (!error) {
        setSavedCollectionIds([defaultCol.id]);
      }
    }
  };

  const handleOpenModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
    setLoading(true);
    await fetchCollections();
    setLoading(false);
  };

  const toggleCollection = async (collectionId: string, isSaved: boolean) => {
    if (isSaved) {
      // Unsave
      setSavedCollectionIds(prev => prev.filter(id => id !== collectionId));
      await supabase
        .from("saved_posts")
        .delete()
        .match({ user_id: currentUserId, post_id: postId, collection_id: collectionId });
    } else {
      // Save
      setSavedCollectionIds(prev => [...prev, collectionId]);
      await supabase
        .from("saved_posts")
        .insert({
          user_id: currentUserId,
          post_id: postId,
          collection_id: collectionId,
        });
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const { data, error } = await supabase
      .from("collections")
      .insert({ user_id: currentUserId, name: newCollectionName.trim() })
      .select()
      .single();

    if (!error && data) {
      setCollections([...collections, data]);
      setNewCollectionName("");
      // Auto-save to the new collection
      toggleCollection(data.id, false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <div className={`flex items-center ${className}`}>
        <button
          onClick={handleQuickSave}
          className="hover:text-accent transition-colors focus:outline-none p-1 -ml-1 flex items-center justify-center"
          aria-label="Save post"
        >
          <Bookmark className={`${iconClassName} ${isSavedToAny ? "fill-accent text-accent" : ""}`} />
        </button>
        <button
          onClick={handleOpenModal}
          className="hover:text-accent transition-colors focus:outline-none p-1 flex items-center justify-center"
          aria-label="Choose collection"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { e.stopPropagation(); setIsModalOpen(false); }}
        >
          <div 
            ref={modalRef}
            className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-heading">Save to...</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-heading">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-60 overflow-y-auto space-y-2">
              {loading ? (
                <div className="text-center text-sm text-body py-4">Loading...</div>
              ) : collections.length === 0 ? (
                <div className="text-center text-sm text-body py-4">No collections yet.</div>
              ) : (
                collections.map(collection => {
                  const isSaved = savedCollectionIds.includes(collection.id);
                  return (
                    <label key={collection.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        checked={isSaved}
                        onChange={() => toggleCollection(collection.id, isSaved)}
                        className="w-4 h-4 text-accent border-border rounded focus:ring-accent"
                      />
                      <span className="text-sm font-medium text-heading flex-1 truncate">{collection.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <form onSubmit={handleCreateCollection} className="p-4 border-t border-border bg-gray-50 flex gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="New collection..."
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={!newCollectionName.trim()}
                className="bg-accent text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
