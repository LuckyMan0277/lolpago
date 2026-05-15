"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAMPIONS,
  championImageUrl,
  type Champion,
} from "@/lib/champions";

type Props = {
  value: Champion | null;
  onChange: (c: Champion) => void;
  excludeKeys?: string[];
  placeholder?: string;
};

const TAG_LABEL: Record<string, string> = {
  Fighter: "전사",
  Tank: "탱커",
  Mage: "마법사",
  Assassin: "암살자",
  Marksman: "원거리",
  Support: "서포터",
};

export function ChampionPicker({
  value,
  onChange,
  excludeKeys = [],
  placeholder = "챔피언 선택",
}: Props) {
  const [open, setOpen] = useState(false);

  const available = CHAMPIONS.filter(
    (c) => !excludeKeys.includes(c.key) || c.key === value?.key,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between h-10 px-2 transition-colors",
          !value &&
            "border-dashed text-muted-foreground/70 hover:border-primary/50",
        )}
      >
        {value ? (
          <span className="flex items-center gap-2 min-w-0">
            <Image
              src={championImageUrl(value.key)}
              alt={value.name_ko}
              width={28}
              height={28}
              className="rounded-md shrink-0 ring-1 ring-border/60"
              unoptimized
            />
            <span className="truncate font-medium">{value.name_ko}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/70 flex items-center gap-1.5">
            <span className="inline-block h-6 w-6 rounded-md border border-dashed border-muted-foreground/30" />
            {placeholder}
          </span>
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 border-border/80 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <Command
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput
            placeholder="챔피언 검색 (한글·영문)"
            className="h-10"
          />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              일치하는 챔피언 없음
            </CommandEmpty>
            <CommandGroup className="p-1">
              {available.map((c) => {
                const selected = value?.key === c.key;
                const primaryTag = c.tags[0];
                return (
                  <CommandItem
                    key={c.key}
                    value={`${c.name_ko} ${c.name_en} ${c.key}`}
                    onSelect={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className={cn(
                      "gap-2.5 px-2 py-1.5 cursor-pointer rounded-md aria-selected:bg-primary/15 data-[selected=true]:bg-primary/15",
                      selected && "bg-primary/10",
                    )}
                  >
                    <Image
                      src={championImageUrl(c.key)}
                      alt={c.name_ko}
                      width={28}
                      height={28}
                      className="rounded-md shrink-0 ring-1 ring-border/40"
                      unoptimized
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium leading-tight">
                        {c.name_ko}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 truncate">
                        {c.name_en}
                      </div>
                    </div>
                    {primaryTag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0">
                        {TAG_LABEL[primaryTag] ?? primaryTag}
                      </span>
                    )}
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 transition-opacity text-primary",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
