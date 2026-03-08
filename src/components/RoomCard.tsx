import { useState, useRef } from "react";
import { ROOM_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Image as ImageIcon, Trash2 } from "lucide-react";

export interface RoomData {
  id: string;
  name: string;
  room_type: string;
  dimensions_text: string;
  plan_file: File | null;
  plan_url: string;
  plan_preview: string; // local preview URL or empty
}

interface RoomCardProps {
  room: RoomData;
  index: number;
  canDelete: boolean;
  onChange: (id: string, field: keyof RoomData, value: any) => void;
  onDelete: (id: string) => void;
}

const RoomCard = ({ room, index, canDelete, onChange, onDelete }: RoomCardProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Поддерживаются только JPG, PNG и PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 10 МБ)");
      return;
    }

    // Set local preview
    if (file.type.startsWith("image/")) {
      onChange(room.id, "plan_preview", URL.createObjectURL(file));
    } else {
      onChange(room.id, "plan_preview", "");
    }
    onChange(room.id, "plan_file", file);
  };

  const removePlan = () => {
    onChange(room.id, "plan_file", null);
    onChange(room.id, "plan_url", "");
    onChange(room.id, "plan_preview", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  const fileName = room.plan_file?.name || (room.plan_url ? room.plan_url.split("/").pop() : "");
  const isPdf = room.plan_file?.type === "application/pdf" || room.plan_url?.endsWith(".pdf");
  const hasFile = room.plan_file || room.plan_url;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">
          Помещение {index + 1}
        </span>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(room.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label>Название *</Label>
        <Input
          placeholder="Кухня, Спальня, Гостиная…"
          value={room.name}
          onChange={(e) => onChange(room.id, "name", e.target.value)}
        />
      </div>

      {/* Type + Dimensions row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Тип</Label>
          <Select
            value={room.room_type}
            onValueChange={(v) => onChange(room.id, "room_type", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите тип" />
            </SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((rt) => (
                <SelectItem key={rt.value} value={rt.value}>
                  {rt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Габариты</Label>
          <Input
            placeholder="4.2×3.1, h=2.7"
            value={room.dimensions_text}
            onChange={(e) => onChange(room.id, "dimensions_text", e.target.value)}
          />
        </div>
      </div>

      {/* Plan upload */}
      <div className="space-y-1">
        <Label>План помещения / чертёж (опционально)</Label>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {hasFile ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 p-3">
            {room.plan_preview ? (
              <img
                src={room.plan_preview}
                alt="План"
                className="h-16 w-16 rounded object-cover"
              />
            ) : isPdf ? (
              <FileText className="h-10 w-10 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            )}
            <span className="flex-1 truncate text-sm text-foreground">
              {fileName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={removePlan}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Загрузить план (JPG, PNG, PDF)
          </Button>
        )}
      </div>
    </div>
  );
};

export default RoomCard;
