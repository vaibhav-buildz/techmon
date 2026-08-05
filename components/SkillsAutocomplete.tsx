"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X } from "lucide-react";

const PREDEFINED_SKILLS = [
  // Web Frontend
  "JavaScript", "TypeScript", "React", "Next.js", "Vue.js", "Angular", "Svelte", "HTML", "CSS",
  "Tailwind CSS", "GraphQL", "REST APIs",
  // Web Backend
  "Node.js", "Python", "Java", "C++", "Rust", "Go", "C#", ".NET", "Ruby", "PHP", "Elixir",
  "Django", "Flask", "FastAPI", "Spring Boot", "Express.js",
  // Databases
  "SQL", "PostgreSQL", "MongoDB", "Redis", "MySQL", "SQLite", "Cassandra", "DynamoDB",
  "Supabase", "Firebase", "Prisma", "Elasticsearch",
  // Cloud & DevOps
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "GitHub Actions",
  "Linux", "Nginx", "Ansible", "Pulumi",
  // AI / ML / Data
  "Machine Learning", "Deep Learning", "Neural Networks", "NLP", "Computer Vision",
  "TensorFlow", "PyTorch", "Scikit-learn", "Data Science", "LLMs", "Generative AI",
  "Pandas", "NumPy", "OpenCV", "Hugging Face", "MLOps", "Data Engineering",
  // Security / Cyber
  "Cybersecurity", "Penetration Testing", "Burp Suite", "OWASP", "Bug Bounty",
  "Network Security", "Cloud Security", "SOC Analysis", "Malware Analysis",
  "Reverse Engineering", "Digital Forensics", "Cryptography",
  // Quantum Computing
  "Quantum Computing", "Qiskit", "Quantum Cryptography",
  // Mobile
  "Android", "iOS Development", "Flutter", "React Native", "Kotlin", "Swift", "Dart",
  // Design & Tools
  "Figma", "UI/UX Design", "Adobe XD", "Blender", "Git",
  // Data Streaming & Messaging
  "Kafka", "RabbitMQ",
  // Blockchain / Web3
  "Blockchain", "Solidity", "Web3", "Smart Contracts",
  // Other CS
  "IoT", "Embedded Systems", "Game Development", "Unity", "Unreal Engine",
  "AR/VR", "Robotics", "ROS", "DevOps", "System Design",
];

type Props = {
  skills: string[];
  onChange: (skills: string[]) => void;
};

export default function SkillsAutocomplete({ skills, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const lowerInput = inputValue.toLowerCase();
      const matched = PREDEFINED_SKILLS.filter(
        (skill) =>
          skill.toLowerCase().includes(lowerInput) &&
          !skills.some(s => s.toLowerCase() === skill.toLowerCase())
      ).slice(0, 8);
      setSuggestions(matched);
      setHighlightIndex(-1);
    } else {
      setSuggestions([]);
      setHighlightIndex(-1);
    }
  }, [inputValue, skills]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-suggestion]");
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIndex]);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...skills, trimmed]);
    }
    setInputValue("");
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  const removeSkill = (indexToRemove: number) => {
    onChange(skills.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const dropdownOpen = isFocused && suggestions.length > 0;

    if (e.key === "ArrowDown" && dropdownOpen) {
      e.preventDefault();
      setHighlightIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && dropdownOpen) {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (dropdownOpen && highlightIndex >= 0) {
        addSkill(suggestions[highlightIndex]);
      } else {
        addSkill(inputValue);
      }
    } else if (e.key === ",") {
      e.preventDefault();
      addSkill(inputValue);
    } else if (e.key === "Escape" && dropdownOpen) {
      e.preventDefault();
      setSuggestions([]);
      setHighlightIndex(-1);
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
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder-gray-400 min-w-[120px] font-mono"
            placeholder={skills.length === 0 ? "e.g. React, TypeScript..." : ""}
            role="combobox"
            aria-expanded={isFocused && suggestions.length > 0}
            aria-activedescendant={highlightIndex >= 0 ? `skill-option-${highlightIndex}` : undefined}
          />
        </div>

        {/* Dropdown Suggestions */}
        {isFocused && suggestions.length > 0 && (
          <div
            ref={listRef}
            role="listbox"
            className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-y-auto max-h-60 animate-fade-in"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                id={`skill-option-${idx}`}
                data-suggestion
                type="button"
                role="option"
                aria-selected={idx === highlightIndex}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur
                  addSkill(suggestion);
                  inputRef.current?.focus();
                }}
                className={`w-full text-left px-4 py-2 text-sm text-heading transition-colors cursor-pointer font-mono border-b border-border last:border-b-0 ${
                  idx === highlightIndex
                    ? "bg-accent/10 text-accent"
                    : "hover:bg-gray-50"
                }`}
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
