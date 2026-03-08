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
import { Trash2 } from "lucide-react";

export interface RoomData {
  id: string;
  name: string;
  room_type: string;
  dimensions_text: string;
}

interface RoomCardProps {
  room: RoomData;
  index: number;
  canDelete: boolean;
  onChange: (id: string, field: keyof RoomData, value: any) => void;
  onDelete: (id: string) => void;
}

const RoomCard = ({ room, index, canDelete, onChange, onDelete }: RoomCardProps) => {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Помещение {index + 1}
        </span>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(room.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Название *</Label>
          <Input
            placeholder="Кухня, Спальня…"
            value={room.name}
            onChange={(e) => onChange(room.id, "name", e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Тип</Label>
          <Select
            value={room.room_type}
            onValueChange={(v) => onChange(room.id, "room_type", v)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Тип" />
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
          <Label className="text-xs">Габариты</Label>
          <Input
            placeholder="4.2×3.1, h=2.7"
            value={room.dimensions_text}
            onChange={(e) => onChange(room.id, "dimensions_text", e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
