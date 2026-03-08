import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface RefUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (ref: { url: string; type: "file" | "link" }) => void;
}

const RefUploadModal = ({ open, onClose, onUploaded }: RefUploadModalProps) => {
  const [tab, setTab] = useState<string>("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Допустимые форматы: JPG, PNG, WEBP");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Файл слишком большой, максимум 10 MB");
      return;
    }

    setUploading(true);
    try {
      const sessionId = getSessionId();
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${sessionId}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("style-images")
        .upload(`user-refs/${fileName}`, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("style-images")
        .getPublicUrl(`user-refs/${fileName}`);

      onUploaded({ url: urlData.publicUrl, type: "file" });
      onClose();
    } catch (e) {
      console.error("Upload error:", e);
      toast.error("Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  };

  const handleLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      toast.error("Вставьте ссылку на изображение");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      toast.error("Некорректная ссылка");
      return;
    }
    onUploaded({ url: trimmed, type: "link" });
    setLinkUrl("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border rounded-none max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-display text-xl font-medium">
            Свой референс
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="px-6 pb-6 pt-4">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="file" className="flex-1 gap-2">
              <Upload className="h-3.5 w-3.5" />
              Загрузить файл
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1 gap-2">
              <Link className="h-3.5 w-3.5" />
              Вставить ссылку
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border border-dashed border-border bg-background py-10 flex flex-col items-center gap-3 hover:border-primary/50 transition-colors duration-350"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              )}
              <span className="caption-style">
                {uploading ? "Загружаю…" : "JPG, PNG, WEBP — макс 10 MB"}
              </span>
            </button>
          </TabsContent>

          <TabsContent value="link">
            <div className="flex flex-col gap-4">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLink()}
              />
              <Button onClick={handleLink} className="w-full">
                Добавить
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default RefUploadModal;
