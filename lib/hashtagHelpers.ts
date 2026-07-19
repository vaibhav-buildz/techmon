import { supabase } from "@/lib/supabase";

export async function processHashtags(postId: string, content: string) {
  if (!content || typeof content !== 'string') return;
  
  // Extract hashtags (e.g., #webdev). Using \w equivalent for tags
  const matches = content.match(/#([a-zA-Z0-9_]+)/g);
  
  // Always clear existing post_hashtags first (handles both edits where tags were removed, and updates)
  await supabase.from("post_hashtags").delete().eq("post_id", postId);

  if (!matches || matches.length === 0) {
    return;
  }

  // Unique lowercased tags without the '#'
  const uniqueTags = Array.from(new Set(matches.map(m => m.slice(1).toLowerCase())));
  
  try {
    // 1. Insert any new tags, ignoring duplicates
    const upsertData = uniqueTags.map(tag => ({ tag }));
    await supabase
      .from("hashtags")
      .upsert(upsertData, { onConflict: "tag", ignoreDuplicates: true });

    // 2. Fetch the IDs for all these tags
    const { data: existingTags, error: tagError } = await supabase
      .from("hashtags")
      .select("id, tag")
      .in("tag", uniqueTags);

    if (tagError) throw tagError;
    if (!existingTags || existingTags.length === 0) return;

    // 3. Insert new post_hashtags
    const postHashtagsData = existingTags.map(tag => ({
      post_id: postId,
      hashtag_id: tag.id
    }));

    const { error: linkError } = await supabase
      .from("post_hashtags")
      .insert(postHashtagsData);

    if (linkError) throw linkError;
    
  } catch (err) {
    console.error("Error processing hashtags:", err);
  }
}
