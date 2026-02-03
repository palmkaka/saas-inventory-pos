-- Create system_announcements table
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'info', -- info, warning, danger, success
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active announcements
CREATE POLICY "Everyone can read active announcements" ON public.system_announcements
    FOR SELECT
    USING (
        is_active = true 
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
    );

-- Policy: Super Admins can do everything
CREATE POLICY "Super Admins can manage announcements" ON public.system_announcements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.is_super_admin = true OR profiles.is_platform_admin = true)
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_system_announcements_updated_at
    BEFORE UPDATE ON public.system_announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
