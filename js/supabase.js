import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://ifgyhjkkpvoocbblknjy.supabase.co";
const supabaseKey = "sb_publishable_VOrQFUOQfErs3UzrxCiSNg_4i-BHV4C";

export const supabase = createClient(supabaseUrl, supabaseKey);
