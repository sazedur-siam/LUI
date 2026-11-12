"use client";

import { ArrowUpIcon, FolderIcon, FolderOpenIcon, HomeIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { addCourseAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Listing {
  path: string;
  parent: string | null;
  home: string;
  folders: string[];
  error?: string;
}

export function AddCourseDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const browse = useCallback(async (dir?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs${dir ? `?path=${encodeURIComponent(dir)}` : ""}`);
      const data = (await res.json()) as Listing;
      if (!res.ok) {
        toast.error(data.error ?? "Cannot open that folder");
        return;
      }
      setListing(data);
      setValue(data.path);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !listing) void browse();
  };

  const submit = (path = value) => {
    setError(null);
    startTransition(async () => {
      const result = await addCourseAction(path);
      if (result.error || !result.id) {
        setError(result.error ?? "Could not add that folder.");
        return;
      }
      toast.success("Course added");
      setOpen(false);
      router.push(`/course/${result.id}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusIcon /> Add course
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-5 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a course folder</DialogTitle>
          <DialogDescription>
            Choose the folder that holds the course. Sub-folders become modules, files become lessons.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Label htmlFor="course-path">Folder path</Label>
          <div className="flex gap-2">
            <Input
              id="course-path"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="/Users/you/Courses/My course"
              className="font-mono text-xs"
              spellCheck={false}
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={() => browse(value)} disabled={loading}>
              Go
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-1 border-b bg-muted/60 px-2 py-1.5">
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={!listing?.parent || loading}
              onClick={() => listing?.parent && browse(listing.parent)}
              aria-label="Parent folder"
            >
              <ArrowUpIcon />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={loading}
              onClick={() => browse(listing?.home)}
              aria-label="Home folder"
            >
              <HomeIcon />
            </Button>
            <span className="ml-1 truncate font-mono text-xs text-muted-foreground" title={listing?.path}>
              {listing?.path ?? "…"}
            </span>
            {loading && <Loader2Icon className="ml-auto size-4 animate-spin text-muted-foreground" />}
          </div>
          <ScrollArea className="h-64">
            <ul className="p-1">
              {listing?.folders.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">No sub-folders here.</li>
              )}
              {listing?.folders.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => browse(`${listing.path.replace(/\/$/, "")}/${name}`)}
                  >
                    <FolderIcon className="size-4 shrink-0 text-[#039BE5]" />
                    <span className="truncate">{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => submit()} disabled={pending || !value.trim()}>
            {pending ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />}
            Use this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
