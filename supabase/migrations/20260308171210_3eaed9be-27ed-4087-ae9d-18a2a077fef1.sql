
-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'other',
  dimensions_text TEXT,
  plan_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching existing pattern - anon access)
CREATE POLICY "anon_select_rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "anon_insert_rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_rooms" ON public.rooms FOR UPDATE USING (true);
CREATE POLICY "anon_delete_rooms" ON public.rooms FOR DELETE USING (true);

-- Create storage bucket for plan uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-uploads', 'plan-uploads', true);

-- Storage RLS policies
CREATE POLICY "Anyone can upload plans" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'plan-uploads');
CREATE POLICY "Anyone can view plans" ON storage.objects FOR SELECT USING (bucket_id = 'plan-uploads');
CREATE POLICY "Anyone can delete plans" ON storage.objects FOR DELETE USING (bucket_id = 'plan-uploads');
