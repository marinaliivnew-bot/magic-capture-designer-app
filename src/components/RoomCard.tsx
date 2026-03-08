import { ROOM_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="border-b border-border pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
      <div className="flex items-center justify-between mb-4">
        <span className="label-style text-muted-foreground">
          Помещение {index + 1}
        </span>
        {canDelete && (
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive transition-colors duration-350"
            onClick={() => onDelete(room.id)}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label className="label-style text-foreground block mb-1">Название *</label>
          <Input
            placeholder="Кухня, Спальня…"
            value={room.name}
            onChange={(e) => onChange(room.id, "name", e.target.value)}
          />
        </div>
        <div>
          <label className="label-style text-foreground block mb-1">Тип</label>
          <Select
            value={room.room_type}
            onValueChange={(v) => onChange(room.id, "room_type", v)}
          >
            <SelectTrigger>
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
        <div>
          <label className="label-style text-foreground block mb-1">Габариты</label>
          <Input
            placeholder="4.2×3.1, h=2.7"
            value={room.dimensions_text}
            onChange={(e) => onChange(room.id, "dimensions_text", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
