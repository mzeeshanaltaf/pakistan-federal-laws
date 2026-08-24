"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatScope } from "@/lib/chat-types";

export interface CatalogCategory {
  id: number;
  slug: string;
  name: string;
  documentCount: number;
}

export interface CatalogDocument {
  slug: string;
  title: string;
  categoryId: number | null;
}

interface ScopeSelectorProps {
  categories: CatalogCategory[];
  documents: CatalogDocument[];
  scope: ChatScope;
  onScopeChange: (scope: ChatScope) => void;
}

export function ScopeSelector({ categories, documents, scope, onScopeChange }: ScopeSelectorProps) {
  const [open, setOpen] = useState(false);

  function select(next: ChatScope) {
    onScopeChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" role="combobox" className="w-full justify-between sm:w-90" />}
      >
        <span className="truncate">{scope.label}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0 sm:w-105" align="start">
        <Command>
          <CommandInput placeholder="Search 525 federal laws..." />
          <CommandList className="max-h-96">
            <CommandEmpty>No law matches that search.</CommandEmpty>
            <CommandGroup heading="Scope">
              <CommandItem value="All laws" onSelect={() => select({ type: "all", label: "All laws" })}>
                <Check className={cn("size-4", scope.type === "all" ? "opacity-100" : "opacity-0")} />
                All laws
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Categories">
              {categories.map((c) => (
                <CommandItem
                  key={c.slug}
                  value={c.name}
                  onSelect={() => select({ type: "category", slug: c.slug, label: c.name })}
                >
                  <Check
                    className={cn(
                      "size-4",
                      scope.type === "category" && scope.slug === c.slug ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.documentCount}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Laws">
              {documents.map((d) => (
                <CommandItem
                  key={d.slug}
                  value={d.title}
                  onSelect={() => select({ type: "document", slug: d.slug, label: d.title })}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      scope.type === "document" && scope.slug === d.slug ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{d.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
