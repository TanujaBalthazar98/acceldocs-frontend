import { useState } from "react";
import { Play, Video, Link as LinkIcon, Upload, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface VideoEmbedProps {
  url?: string;
  title?: string;
  aspectRatio?: "16:9" | "4:3" | "1:1";
  className?: string;
}

// Parse video URL and return embed info
function parseVideoUrl(url: string): { type: 'youtube' | 'vimeo' | 'loom' | 'unknown'; embedUrl: string | null } {
  try {
    const urlObj = new URL(url);
    
    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = '';
      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v') || '';
      }
      if (videoId) {
        return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${videoId}` };
      }
    }
    
    // Vimeo
    if (urlObj.hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (videoId) {
        return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${videoId}` };
      }
    }
    
    // Loom
    if (urlObj.hostname.includes('loom.com')) {
      const match = urlObj.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
      if (match) {
        return { type: 'loom', embedUrl: `https://www.loom.com/embed/${match[1]}` };
      }
    }
    
    return { type: 'unknown', embedUrl: null };
  } catch {
    return { type: 'unknown', embedUrl: null };
  }
}

export function VideoEmbed({ url, title, aspectRatio = "16:9", className = "" }: VideoEmbedProps) {
  if (!url) return null;
  
  const { embedUrl, type } = parseVideoUrl(url);
  
  const aspectRatioClass = {
    "16:9": "aspect-video",
    "4:3": "aspect-[4/3]",
    "1:1": "aspect-square",
  }[aspectRatio];
  
  if (!embedUrl) {
    // Unknown video type - show as link
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={`flex items-center gap-2 p-4 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors ${className}`}
      >
        <Video className="h-5 w-5 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{title || url}</span>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </a>
    );
  }
  
  return (
    <div className={`relative ${aspectRatioClass} ${className}`}>
      <iframe
        src={embedUrl}
        title={title || "Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full rounded-lg"
      />
    </div>
  );
}

interface VideoInsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (videoData: { type: 'embed' | 'upload'; url: string; title?: string }) => void;
}

export function VideoInsertDialog({ open, onOpenChange, onInsert }: VideoInsertDialogProps) {
  const [activeTab, setActiveTab] = useState<"embed" | "upload">("embed");
  const [embedUrl, setEmbedUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  
  const handleEmbedInsert = () => {
    if (!embedUrl.trim()) {
      setError("Please enter a video URL");
      return;
    }
    
    const { embedUrl: parsedUrl } = parseVideoUrl(embedUrl);
    if (!parsedUrl) {
      setError("Unsupported video URL. Please use YouTube, Vimeo, or Loom links.");
      return;
    }
    
    onInsert({ type: 'embed', url: embedUrl, title: title || undefined });
    resetAndClose();
  };
  
  const resetAndClose = () => {
    setEmbedUrl("");
    setTitle("");
    setError("");
    setActiveTab("embed");
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Insert Video
          </DialogTitle>
          <DialogDescription>
            Embed a video from YouTube, Vimeo, or Loom.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "embed" | "upload")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="embed" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Embed URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2" disabled>
              <Upload className="h-4 w-4" />
              Upload (Soon)
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="embed" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL</Label>
              <Input
                id="video-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={embedUrl}
                onChange={(e) => {
                  setEmbedUrl(e.target.value);
                  setError("");
                }}
                className="bg-secondary"
              />
              <p className="text-xs text-muted-foreground">
                Supports YouTube, Vimeo, and Loom links
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="video-title">Title (optional)</Label>
              <Input
                id="video-title"
                placeholder="Video title for accessibility"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-secondary"
              />
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            {/* Preview */}
            {embedUrl && parseVideoUrl(embedUrl).embedUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <VideoEmbed url={embedUrl} title={title} />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="upload" className="mt-4">
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Video upload coming soon</p>
              <p className="text-xs mt-1">Use embed URLs for now</p>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={handleEmbedInsert} disabled={!embedUrl.trim()}>
            <Play className="h-4 w-4 mr-2" />
            Insert Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { parseVideoUrl };
