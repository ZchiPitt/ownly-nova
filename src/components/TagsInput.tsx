/**
 * Tags Input Component
 *
 * Input field for adding and managing tags on items.
 *
 * Features:
 * - Displays existing tags as removable chips
 * - AI-suggested tags show sparkle indicator
 * - Type to add new tags (Enter or comma confirms)
 * - Autocomplete dropdown suggests from user's existing tags
 * - Max 20 tags per item, max 50 chars per tag
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTags } from '@/hooks/useTags';
import { getColorHex, getColorTint, isLightColor } from '@/lib/colorUtils';

/**
 * Props for the TagsInput component
 */
export interface TagsInputProps {
  /** Current tags */
  value: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** AI-suggested tags (shown with sparkle) */
  aiSuggestedTags?: string[];
  /** Whether any tag is AI-filled (sparkle indicator for label) */
  isAIFilled?: boolean;
  /** Callback when AI field is modified */
  onAIFieldModified?: () => void;
}

/** Maximum number of tags allowed */
const MAX_TAGS = 20;
/** Maximum characters per tag */
const MAX_TAG_LENGTH = 50;

/**
 * AI Sparkle icon component
 */
function SparkleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-label="AI-suggested"
    >
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" />
    </svg>
  );
}

/**
 * Inner content component that resets state when parent changes
 */
function TagsInputContent({
  value,
  onChange,
  aiSuggestedTags = [],
  isAIFilled = false,
  onAIFieldModified,
}: TagsInputProps) {
  const { getSuggestions } = useTags();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get suggestions based on current input - memoized
  const suggestions = useMemo(() => {
    return inputValue.trim().length > 0 ? getSuggestions(inputValue, value) : [];
  }, [inputValue, value, getSuggestions]);

  // Track which tags are AI-suggested - memoized
  const aiTagsSet = useMemo(
    () => new Set(aiSuggestedTags.map((t) => t.toLowerCase())),
    [aiSuggestedTags]
  );

  /**
   * Check if a tag is AI-suggested
   */
  function isAITag(tag: string): boolean {
    return aiTagsSet.has(tag.toLowerCase());
  }

  /**
   * Add a new tag
   */
  function addTag(tag: string) {
    const trimmedTag = tag.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmedTag) return;

    // Check if tag already exists (case-insensitive)
    const exists = value.some(
      (t) => t.toLowerCase() === trimmedTag.toLowerCase()
    );
    if (exists) return;

    // Check max tags limit
    if (value.length >= MAX_TAGS) return;

    onChange([...value, trimmedTag]);
    setInputValue('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }

  /**
   * Remove a tag
   */
  function removeTag(tagToRemove: string) {
    const newTags = value.filter((t) => t !== tagToRemove);
    onChange(newTags);

    // Check if we removed an AI tag
    if (isAITag(tagToRemove) && onAIFieldModified) {
      onAIFieldModified();
    }
  }

  /**
   * Handle input change
   */
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;

    // Check if user typed a comma - add the tag
    if (newValue.includes(',')) {
      const parts = newValue.split(',');
      // Add all parts except the last one (which might be empty or a new partial tag)
      for (let i = 0; i < parts.length - 1; i++) {
        const tag = parts[i].trim();
        if (tag) {
          addTag(tag);
        }
      }
      // Keep the last part in the input
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(newValue.slice(0, MAX_TAG_LENGTH));
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    }
  }

  /**
   * Handle input key down
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        // Select highlighted suggestion
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        // Add current input as tag
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspace pressed with empty input
      removeTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }

  /**
   * Handle input focus
   */
  function handleFocus() {
    if (inputValue.trim()) {
      setShowSuggestions(true);
    }
  }

  /**
   * Handle clicking outside to close suggestions
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handle suggestion click
   */
  function handleSuggestionClick(suggestion: string) {
    addTag(suggestion);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-medium text-[#4a3f35] mb-2">
        Tags
        {isAIFilled && (
          <span className="inline-flex items-center gap-1 text-xs text-[#4a3f35] bg-[#f5ebe0] px-2 py-0.5 rounded-full">
            <SparkleIcon className="w-3 h-3" />
            AI
          </span>
        )}
      </label>

      <div
        className={`min-h-[48px] px-3 py-2 border rounded-xl focus-within:ring-2 focus-within:ring-[#d6ccc2] focus-within:border-[#d6ccc2] transition-colors ${
          isAIFilled ? 'border-[#d6ccc2] bg-[#fdf8f2]/50' : 'border-[#f5ebe0] bg-white'
        }`}
      >
        {/* Tags and input container */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Existing tags as chips */}
          {value.map((tag) => {
            const colorHex = getColorHex(tag);
            const isColor = !!colorHex;
            const isAI = isAITag(tag);
            const chipStyle = isColor && colorHex ? { backgroundColor: getColorTint(colorHex) } : undefined;
            const dotBorderClass = colorHex && isLightColor(colorHex)
              ? 'border border-[#d6ccc2]'
              : 'border border-transparent';
            const chipClassName = `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ${
              isAI
                ? isColor
                  ? 'text-[#4a3f35] ring-1 ring-[#d6ccc2]'
                  : 'bg-[#f5ebe0] text-[#4a3f35]'
                : isColor
                  ? 'text-[#4a3f35]'
                  : 'bg-[#f5ebe0] text-[#4a3f35]'
            }`;
            const removeHoverClass = isAI && !isColor ? 'hover:bg-[#4a3f35]' : 'hover:bg-[#4a3f35]';

            return (
              <span
                key={tag}
                className={chipClassName}
                style={chipStyle}
              >
                {isColor && colorHex && (
                  <span
                    role="img"
                    aria-label={`Color: ${tag}`}
                    className={`inline-block w-2 h-2 rounded-full ${dotBorderClass}`}
                    style={{ backgroundColor: colorHex }}
                  />
                )}
                {isAI && <SparkleIcon className="w-3 h-3 text-[#8d7b6d]" />}
                <span className="max-w-[150px] truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className={`ml-0.5 p-0.5 rounded-full hover:bg-opacity-20 transition-colors ${removeHoverClass}`}
                  aria-label={`Remove tag ${tag}`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            );
          })}

          {/* Input field */}
          {value.length < MAX_TAGS && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={value.length === 0 ? 'Add tags...' : ''}
              className="flex-1 min-w-[100px] py-1 bg-transparent outline-none placeholder-[#d6ccc2]"
            />
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full bg-white border border-[#f5ebe0] rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-[#fdf8f2] text-[#4a3f35]'
                    : 'hover:bg-[#fdf8f2]'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-[#d6ccc2]">
          Press Enter or comma to add tags
        </p>
        <p className="text-xs text-[#d6ccc2]">
          {value.length}/{MAX_TAGS}
        </p>
      </div>
    </div>
  );
}

export function TagsInput(props: TagsInputProps) {
  return <TagsInputContent {...props} />;
}
