"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X } from "lucide-react";

const PREDEFINED_SKILLS = [
  "JavaScript", "Python", "React", "Next.js", "Node.js", "TypeScript", "Java", "C++", 
  "SQL", "MongoDB", "PostgreSQL", "AWS", "Docker", "Kubernetes", "Git", "Figma", 
  "UI/UX Design", "Machine Learning", "Data Science", "DevOps", "Cybersecurity", 
  "Flutter", "Android", "iOS Development", "HTML", "CSS", "Tailwind CSS", "GraphQL", 
  "REST APIs", "Firebase", "Supabase", "Rust", "Go", "C#", ".NET", "Vue.js", "Angular", 
  "Svelte", "Prisma", "Redis", "Kafka", "Elasticsearch", "Linux", "GCP", "Azure"
];

type Props = {
  skills: string[];
  onChange: (skills: string[]) => void;
};

export default function SkillsAutocomplete({ skills, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const lowerInput = inputValue.toLowerCase();
      const matched = PREDEFINED_SKILLS.filter(
        (skill) => 
          skill.toLowerCase().includes(lowerInput) && 
          !skills.some(s => s.toLowerCase() === skill.toLowerCase())
      ).slice(0, 5); // show up to 5 suggestions
      setSuggestions(matched);
    } else {
      setSuggestions([]);
    }
  }, [inputValue, skills]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...skills, trimmed]);
    }
    setInputValue("");
    setSuggestions([]);
  };

  const removeSkill = (indexToRemove: number) => {
    onChange(skills.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && skills.length > 0) {
      removeSkill(skills.length - 1);
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      <div className="relative">
        <div className={`w-full px-3 py-2 bg-surface border rounded-lg transition-shadow flex flex-wrap gap-2 items-center ${isFocused ? 'ring-2 ring-accent border-transparent' : 'border-border'}`}>
          {skills.map((skill, idx) => (
            <span
              key={idx}
              className="font-mono text-xs bg-blue-50 pl-3 pr-2 py-1 text-accent rounded-full border border-accent/20 flex items-center gap-1 shrink-0"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(idx)}
                className="hover:bg-blue-100 rounded-full p-0.5 transition-colors focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder-gray-400 min-w-[120px] font-mono"
            placeholder={skills.length === 0 ? "e.g. React, TypeScript..." : ""}
          />
        </div>

        {/* Dropdown Suggestions */}
        {isFocused && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden animate-fade-in">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  addSkill(suggestion);
                  setIsFocused(true); // keep focus? React will blur the input when button is clicked
                }}
                className="w-full text-left px-4 py-2 text-sm text-heading hover:bg-gray-50 transition-colors cursor-pointer font-mono border-b border-border last:border-b-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
