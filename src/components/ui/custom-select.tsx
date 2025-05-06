"use client";

import React, { useState, useRef, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FixedSizeList as List } from "react-window";

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface CustomSelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T | undefined;
  onValueChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  virtualized?: boolean;
  maxHeight?: number;
  itemHeight?: number;
}

export function CustomSelect<T extends string>({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  disabled = false,
  isLoading = false,
  loadingPlaceholder = "Loading...",
  className = "",
  triggerClassName = "bg-tw-blue-200 text-white",
  contentClassName = "bg-tw-blue-200 text-white",
  virtualized = true,
  maxHeight = 200,
  itemHeight = 35,
}: CustomSelectProps<T>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  // Update content width when the select content changes
  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.offsetWidth);
    }
  }, [contentRef]);

  // If we have fewer than 10 items or virtualization is disabled,
  // don't use windowing as it's not needed for performance
  const shouldVirtualize = virtualized && options.length > 20;

  return (
    <div className={className}>
      <Select value={isLoading ? undefined : value} onValueChange={onValueChange} disabled={disabled || isLoading}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={isLoading ? loadingPlaceholder : placeholder} />
        </SelectTrigger>
        <SelectContent ref={contentRef} className={contentClassName}>
          {isLoading ? (
            <SelectItem value="loading" disabled>
              {loadingPlaceholder}
            </SelectItem>
          ) : shouldVirtualize ? (
            <div style={{ height: Math.min(maxHeight, options.length * itemHeight) }}>
              <List
                height={Math.min(maxHeight, options.length * itemHeight)}
                itemCount={options.length}
                itemSize={itemHeight}
                width="100%"
                className="no-scrollbar"
              >
                {({ index, style }) => {
                  const option = options[index];
                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      style={{ ...style, width: contentWidth || "100%" }}
                    >
                      {option.label}
                    </SelectItem>
                  );
                }}
              </List>
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
